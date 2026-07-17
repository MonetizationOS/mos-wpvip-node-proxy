/**
 * Minimal HTTP server that runs the same proxy pipeline as the Cloudflare Worker.
 * For production, prefer mounting `proxyFetch` on your framework or reverse proxy.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { loadEnvFromProcess } from './loadEnv.js'
import { writeHeadFromFetchResponse } from './outgoingNodeHeaders.js'
import { parseServerCliArgs } from './parseArgs.js'
import { createProxyFetch } from './proxyHandler.js'
import type { ProxyEnv } from './env.js'
import { resolveOriginUrlForRequest } from './requestRouting.js'

const port = Number(process.env.PORT ?? '8787')

let handleRequest: (request: Request) => Promise<Response>
let env: ProxyEnv
try {
    const cli = parseServerCliArgs()
    env = loadEnvFromProcess({ domainMapFile: cli.domainMapFile })
    handleRequest = createProxyFetch(env)
} catch (e) {
    console.error(e instanceof Error ? e.message : e)
    console.error(
        'Set cookie names. In single-domain mode also set ORIGIN_URL, SURFACE_SLUG, and MONETIZATION_OS_SECRET_KEY.',
    )
    console.error('In multi-domain mode, pass --domain-map <path> or set DOMAIN_MAP_FILE.')
    console.error('Each domain map entry must reference a VIP env var via mosSecretKeyEnvVar.')
    process.exit(1)
}

createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // WordPress VIP requires a health check at this path that returns 200 quickly.
    if (req.url?.startsWith('/cache-healthcheck')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('Ok')
        return
    }

    try {
        const host = req.headers.host ?? `localhost:${port}`
        // Prefer x-forwarded-proto set by the upstream reverse proxy (e.g. WP VIP edge)
        // so that the reconstructed URL carries the correct scheme. Without this, all
        // origin links in the HTML body would be rewritten to http:// even when the
        // client connected over HTTPS.
        // Fall back to the mapped origin's scheme for local dev where no proxy is present.
        const proto =
            req.headers['x-forwarded-proto'] ??
            (() => {
                const originUrl = resolveOriginUrlForRequest(env, `https://${host}${req.url ?? '/'}`)
                return originUrl ? new URL(originUrl).protocol.replace(':', '') : 'https'
            })()
        const url = new URL(req.url ?? '/', `${proto}://${host}`)

        const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
        const reqBody = hasBody ? Readable.toWeb(Readable.from(req)) : undefined

        const request = new Request(url, {
            method: req.method,
            headers: req.headers as HeadersInit,
            body: reqBody as BodyInit | undefined,
            duplex: hasBody ? 'half' : undefined,
        } as RequestInit)

        const response = await handleRequest(request)

        const payload = response.body ? Buffer.from(await response.arrayBuffer()) : null

        writeHeadFromFetchResponse(res, response)

        if (payload?.length) {
            res.end(payload)
        } else {
            res.end()
        }
    } catch (err) {
        console.error(err)
        if (!res.headersSent) {
            res.writeHead(500)
        }
        res.end('Internal Server Error')
    }
}).listen(port, () => {
    if (env.domainMap) {
        const hosts = Object.keys(env.domainMap).join(', ')
        console.error(`nodejs-proxy-worker listening on http://localhost:${port} (multi-domain: ${hosts})`)
        return
    }
    console.error(`nodejs-proxy-worker listening on http://localhost:${port}`)
})
