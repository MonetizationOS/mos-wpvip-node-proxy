import { setImmediate } from 'node:timers/promises'
import type { ElementHandlers, HtmlRewriterAdapter, HtmlRewriterCapabilities, HtmlRewriterSession } from '@monetizationos/proxy'
import { Element, type ElementContentHandlers, type EndTag, HTMLRewriter, type TextChunk } from '../../vendor/lol-html/dist/lol_html.js'
import { sanitizeHeadersForDecodedBody } from '../sanitizeHeaders.js'

// A WASM write runs synchronously, so one write of a 2 MB page would hold the event loop for tens
// of ms. Slicing and yielding between slices lets other requests run, at no measurable cost.
const WRITE_SLICE_BYTES = 16 * 1024

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

// Each handler argument owns a small WASM allocation that only free() or a rare GC finaliser
// releases, so without this a 300 KB page leaks ~200 KB. They are only valid during the handler
// anyway, as on Cloudflare.
const freeAfter =
    <T extends { free(): void }>(handler: (arg: T) => unknown) =>
    (arg: T) => {
        try {
            if (handler(arg) instanceof Promise) throw new TypeError('HTML rewriter handlers must be synchronous')
        } finally {
            arg.free()
        }
    }

// A throw inside an end-tag handler traps the WASM instance (lol-html's JS API unwraps it), so it
// is held here and rethrown once the write returns. Writes are synchronous, so one slot is enough.
let endTagError: { error: unknown } | undefined

const throwEndTagError = () => {
    const pending = endTagError
    endTagError = undefined
    if (pending) throw pending.error
}

const onEndTag = Element.prototype.onEndTag
Element.prototype.onEndTag = function (this: Element, handler: (endTag: EndTag) => unknown) {
    onEndTag.call(
        this,
        freeAfter((endTag: EndTag) => {
            try {
                return handler(endTag)
            } catch (error) {
                endTagError ??= { error }
            }
        }),
    )
}

// The core learns a selector is invalid from on() throwing, before any transform, so selectors are
// checked against a throwaway rewriter. Component selectors repeat across requests, hence the cache.
const validSelectors = new Set<string>()

function assertValidSelector(selector: string): void {
    if (validSelectors.has(selector)) return
    const probe = new HTMLRewriter('utf-8', () => {})
    try {
        probe.on(selector, {})
    } finally {
        probe.free()
    }
    if (validSelectors.size >= 1024) validSelectors.clear()
    validSelectors.add(selector)
}

/**
 * lol-html backed HtmlRewriterAdapter for Node.js, using Cloudflare's lol-html JS API built to
 * WASM (see vendor/lol-html). Handlers must be synchronous, as the core's are.
 *
 * transform() returns a Response immediately; rewriting runs as its body is consumed.
 * Content-Encoding, Content-Length and Transfer-Encoding are dropped because the body is decoded.
 */
export class LolHtmlRewriterAdapter implements HtmlRewriterAdapter {
    readonly capabilities: HtmlRewriterCapabilities = { onEndTag: true, nthChild: true }

    create(): HtmlRewriterSession {
        return new LolHtmlSession()
    }
}

// The WASM rewriter only exists during transform(). The core creates sessions it never
// transforms, and a rewriter allocated for those would wait on GC to be freed.
class LolHtmlSession implements HtmlRewriterSession {
    private readonly handlers: [string, ElementContentHandlers][] = []
    private consumed = false

    // The vendored elements and text chunks match the core's interfaces. Handlers are called as
    // methods, since some of the core's use `this`.
    on(selector: string, handlers: ElementHandlers): this {
        assertValidSelector(selector)
        const h = handlers as unknown as Required<ElementContentHandlers>
        this.handlers.push([
            selector,
            {
                element: handlers.element ? freeAfter((el: Element) => h.element(el)) : undefined,
                text: handlers.text ? freeAfter((chunk: TextChunk) => h.text(chunk)) : undefined,
            },
        ])
        return this
    }

    transform(response: Response): Response {
        if (this.consumed) {
            throw new Error('LolHtmlSession can only transform a single response')
        }
        this.consumed = true

        const init = {
            status: response.status,
            statusText: response.statusText,
            headers: sanitizeHeadersForDecodedBody(new Headers(response.headers)),
        }
        if (!response.body || NULL_BODY_STATUSES.has(response.status)) return new Response(null, init)

        const { handlers } = this
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                // The vendored build hands over output once per write, not per token.
                const output: Uint8Array[] = []
                const rewriter = new HTMLRewriter('utf-8', (chunk) => output.push(chunk))
                try {
                    for (const [selector, handler] of handlers) rewriter.on(selector, handler)
                    const body = new TextEncoder().encode(await response.text())
                    for (let offset = 0; offset < body.length; offset += WRITE_SLICE_BYTES) {
                        if (offset > 0) await setImmediate()
                        rewriter.write(body.subarray(offset, offset + WRITE_SLICE_BYTES))
                        throwEndTagError()
                    }
                    rewriter.end()
                    throwEndTagError()
                    // Output arrives once per slice; one copy is cheaper than many stream chunks.
                    if (output.length > 0) controller.enqueue(output.length === 1 ? output[0] : Buffer.concat(output))
                    controller.close()
                } catch (error) {
                    controller.error(error)
                } finally {
                    try {
                        rewriter.free()
                    } catch {
                        // Only a trapped instance refuses; keep the original error.
                    }
                }
            },
        })

        return new Response(stream, init)
    }
}
