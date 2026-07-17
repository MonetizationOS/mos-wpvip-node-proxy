import type { ServerResponse } from 'node:http'

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

/**
 * Send fetch Response metadata to a Node ServerResponse.
 * Omits hop-by-hop and wire-format headers from the origin so a single `res.end(buffer)`
 * is valid (avoids advertising `chunked` while sending a raw buffer, which breaks clients).
 */
export function writeHeadFromFetchResponse(res: ServerResponse, response: Response): void {
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

    res.writeHead(response.status, response.statusText)
}
