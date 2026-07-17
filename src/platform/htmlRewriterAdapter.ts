import { type Element as WasmElement, HTMLRewriter as WasmHTMLRewriter } from 'html-rewriter-wasm'
import type {
    ContentOptions,
    ElementHandlers,
    HtmlRewriterAdapter,
    HtmlRewriterCapabilities,
    HtmlRewriterSession,
    RewriterElement,
} from '@monetizationos/proxy'
import { sanitizeHeadersForDecodedBody } from '../sanitizeHeaders.js'

/**
 * WASM (lol-html) backed HtmlRewriterAdapter for Node.js.
 *
 * Wraps html-rewriter-wasm to satisfy the platform-agnostic HtmlRewriterAdapter interface
 * expected by @monetizationos/proxy. transform() returns a Response immediately with a
 * streaming body so the interface contract is met synchronously; the actual WASM rewriting
 * runs as the body is consumed.
 *
 * Content-Encoding / Content-Length / Transfer-Encoding headers are stripped from the
 * transformed response because the body is decoded text — keeping them would cause
 * ERR_CONTENT_DECODING_FAILED in browsers.
 */
export class LolHtmlRewriterAdapter implements HtmlRewriterAdapter {
    readonly capabilities: HtmlRewriterCapabilities = { onEndTag: true, nthChild: true }

    create(): HtmlRewriterSession {
        return new LolHtmlSession()
    }
}

class LolHtmlSession implements HtmlRewriterSession {
    private readonly outputChunks: Uint8Array[] = []
    private readonly rewriter: WasmHTMLRewriter
    private consumed = false

    constructor() {
        this.rewriter = new WasmHTMLRewriter((chunk) => {
            if (chunk.byteLength > 0) {
                this.outputChunks.push(new Uint8Array(chunk))
            }
        })
    }

    on(selector: string, handlers: ElementHandlers): this {
        this.rewriter.on(selector, {
            element: handlers.element
                ? async (element) => {
                      await handlers.element?.(adaptElement(element))
                  }
                : undefined,
            text: handlers.text
                ? async (text) => {
                      await handlers.text?.({
                          text: text.text,
                          lastInTextNode: text.lastInTextNode,
                          removed: text.removed,
                          remove: () => text.remove(),
                      })
                  }
                : undefined,
        })
        return this
    }

    transform(response: Response): Response {
        if (this.consumed) {
            throw new Error('LolHtmlSession can only transform a single response')
        }
        this.consumed = true

        const rewriter = this.rewriter
        const outputChunks = this.outputChunks

        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    const body = await response.text()
                    await rewriter.write(new TextEncoder().encode(body))
                    await rewriter.end()
                    for (const chunk of outputChunks) {
                        controller.enqueue(chunk)
                    }
                    controller.close()
                } catch (error) {
                    controller.error(error)
                } finally {
                    rewriter.free()
                }
            },
        })

        return new Response(stream, {
            status: response.status,
            statusText: response.statusText,
            headers: sanitizeHeadersForDecodedBody(new Headers(response.headers)),
        })
    }
}

const adaptElement = (element: WasmElement): RewriterElement => ({
    get removed() {
        return element.removed
    },
    get tagName() {
        return element.tagName
    },
    getAttribute: (name: string) => element.getAttribute(name),
    hasAttribute: (name: string) => element.hasAttribute(name),
    setAttribute: (name: string, value: string) => {
        element.setAttribute(name, value)
    },
    removeAttribute: (name: string) => {
        element.removeAttribute(name)
    },
    before: (content: string, options?: ContentOptions) => {
        element.before(content, toWasmOptions(options))
    },
    after: (content: string, options?: ContentOptions) => {
        element.after(content, toWasmOptions(options))
    },
    prepend: (content: string, options?: ContentOptions) => {
        element.prepend(content, toWasmOptions(options))
    },
    append: (content: string, options?: ContentOptions) => {
        element.append(content, toWasmOptions(options))
    },
    replace: (content: string, options?: ContentOptions) => {
        element.replace(content, toWasmOptions(options))
    },
    remove: () => {
        element.remove()
    },
    onEndTag: (callback: () => void | Promise<void>) => {
        element.onEndTag(async () => {
            await callback()
        })
    },
})

const toWasmOptions = (options?: ContentOptions): { html?: boolean } | undefined =>
    options?.html === undefined ? undefined : { html: options.html }
