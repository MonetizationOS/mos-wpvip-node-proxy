import type { ServerResponse } from 'node:http'

/** Response header set when `EXPOSE_PROXY_FINGERPRINT` is enabled. */
export const PROXY_FINGERPRINT_HEADER = 'x-mos-proxy'
export const PROXY_FINGERPRINT_VALUE = '1'

const SKIP = new Set([
    'connection',
    'content-encoding',
    'content-length',
    'keep-alive',
    'proxy-connection',
    'trailer',
    'transfer-encoding',
    'upgrade',
])

export type WriteHeadOptions = {
    /** When true, set {@link PROXY_FINGERPRINT_HEADER} on the outgoing response. */
    fingerprint?: boolean
}

/**
 * Send fetch Response metadata to a Node ServerResponse.
 * Omits hop-by-hop and wire-format headers from the origin so a single `res.end(buffer)`
 * is valid (avoids advertising `chunked` while sending a raw buffer, which breaks clients).
 */
export function writeHeadFromFetchResponse(
    res: ServerResponse,
    response: Response,
    options: WriteHeadOptions = {},
): void {
    const h = new Headers(response.headers)
    for (const name of SKIP) {
        h.delete(name)
    }

    const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
    h.delete('set-cookie')

    h.forEach((value, name) => {
        res.appendHeader(name, value)
    })
    for (const cookie of setCookies) {
        res.appendHeader('Set-Cookie', cookie)
    }

    if (options.fingerprint) {
        res.setHeader(PROXY_FINGERPRINT_HEADER, PROXY_FINGERPRINT_VALUE)
    }

    res.writeHead(response.status, response.statusText)
}
