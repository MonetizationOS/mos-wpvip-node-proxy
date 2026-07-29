import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import { PROXY_FINGERPRINT_HEADER, writeHeadFromFetchResponse } from '../src/outgoingNodeHeaders'

function captureHeaders(fingerprint: boolean, response: Response): Promise<Record<string, string | string[] | undefined>> {
    return new Promise((resolve, reject) => {
        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
            writeHeadFromFetchResponse(res, response, { fingerprint })
            res.end()
        })
        server.listen(0, () => {
            const address = server.address()
            if (!address || typeof address === 'string') {
                reject(new Error('expected TCP address'))
                return
            }
            fetch(`http://127.0.0.1:${address.port}/`)
                .then(async (res) => {
                    const headers: Record<string, string | string[] | undefined> = {}
                    res.headers.forEach((value, name) => {
                        headers[name] = value
                    })
                    server.close()
                    resolve(headers)
                })
                .catch((error) => {
                    server.close()
                    reject(error)
                })
        })
    })
}

describe('writeHeadFromFetchResponse fingerprint', () => {
    it('adds x-mos-proxy when fingerprint is enabled', async () => {
        const headers = await captureHeaders(true, new Response('ok', { status: 200 }))
        expect(headers[PROXY_FINGERPRINT_HEADER]).toBe('1')
    })

    it('omits x-mos-proxy when fingerprint is disabled', async () => {
        const headers = await captureHeaders(false, new Response('ok', { status: 200 }))
        expect(headers[PROXY_FINGERPRINT_HEADER]).toBeUndefined()
    })
})
