/**
 * Remove headers that describe a compressed or chunked wire encoding when the body
 * has already been decoded (e.g. via `response.text()`) or replaced with a plain string.
 * Keeping `Content-Encoding: gzip` on an uncompressed body causes ERR_CONTENT_DECODING_FAILED.
 */
export function sanitizeHeadersForDecodedBody(headers: Headers): Headers {
    const h = new Headers(headers)
    h.delete('content-encoding')
    h.delete('content-length')
    h.delete('transfer-encoding')
    return h
}
