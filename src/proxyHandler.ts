import {
    hostPathMatcher,
    MOSProxyBuilder,
    type ConfigFactory,
    type Fetcher,
    type MOSConfigInput,
} from '@monetizationos/proxy'
import type { ProxyEnv } from './env.js'
import { LolHtmlRewriterAdapter } from './platform/htmlRewriterAdapter.js'
import { nodeIdentityProvider } from './platform/nodeIdentityProvider.js'
import { WpVipGeoProvider } from './platform/wpvipGeoProvider.js'

// Hop-by-hop headers that Node.js (undici) rejects on outgoing requests.
const HOP_BY_HOP = new Set([
    'connection',
    'keep-alive',
    'proxy-connection',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
])

// Public-host headers must not be forwarded to ORIGIN_URL. VIP serves HTML for an
// unrecognized Host but returns empty 404s for /wp-content/uploads and similar file paths.
const ORIGIN_HOST_HEADERS = new Set(['host', 'x-forwarded-host'])

/**
 * Build the Request used for the upstream origin fetch.
 * - Strips hop-by-hop headers rejected by undici.
 * - Strips Host / X-Forwarded-Host so undici derives Host from the origin URL.
 * - Forces identity encoding so HTML bodies are always plain text after the origin fetch.
 */
export function buildNodeOriginRequest(request: Request): Request {
    const headers = new Headers()
    request.headers.forEach((value, name) => {
        const lower = name.toLowerCase()
        if (HOP_BY_HOP.has(lower) || ORIGIN_HOST_HEADERS.has(lower)) {
            return
        }
        headers.set(name, value)
    })
    headers.delete('host')
    headers.delete('x-forwarded-host')
    headers.set('Accept-Encoding', 'identity')
    return new Request(request, { headers })
}

/**
 * Origin fetcher adapted for Node.js.
 */
function createNodeOriginFetcher(): Fetcher {
    return async (request: Request): Promise<Response> => fetch(buildNodeOriginRequest(request))
}

function parseOriginRequestHeaders(env: ProxyEnv): Record<string, string> | undefined {
    if (!env.ORIGIN_REQUEST_HEADERS) {
        return undefined
    }

    try {
        return JSON.parse(env.ORIGIN_REQUEST_HEADERS) as Record<string, string>
    } catch {
        console.warn('ORIGIN_REQUEST_HEADERS is not valid JSON; ignoring')
        return undefined
    }
}

function buildSharedConfig(env: ProxyEnv): Partial<MOSConfigInput> {
    return {
        mosHost: env.MONETIZATION_OS_HOST ?? 'https://api.monetizationos.com',
        mosEndpointsPrefix: env.MONETIZATION_OS_ENDPOINTS_PREFIX,
        anonymousSessionCookieName: env.ANONYMOUS_SESSION_COOKIE_NAME,
        authenticatedUserJwtCookieName: env.AUTHENTICATED_USER_JWT_COOKIE_NAME,
        injectScriptUrl: env.INJECT_SCRIPT_URL,
        surfaceDecisionsIgnorePaths: env.SURFACE_DECISIONS_IGNORE_PATHS,
        surfaceDecisionsCookies: env.SURFACE_DECISIONS_COOKIES,
        originRequestHeaders: parseOriginRequestHeaders(env),
    }
}

function resolveConfigSource(env: ProxyEnv): MOSConfigInput | ConfigFactory {
    const shared = buildSharedConfig(env)

    if (env.domainMap) {
        const rules = Object.entries(env.domainMap).map(([host, entry]) => ({
            host,
            config: {
                originUrl: entry.originUrl,
                surfaceSlug: entry.surfaceSlug,
                mosSecretKey: entry.mosSecretKey,
            },
        }))

        return hostPathMatcher(rules, shared)
    }

    if (env.ORIGIN_URL && env.SURFACE_SLUG && env.MONETIZATION_OS_SECRET_KEY) {
        return {
            ...shared,
            originUrl: env.ORIGIN_URL,
            surfaceSlug: env.SURFACE_SLUG,
            mosSecretKey: env.MONETIZATION_OS_SECRET_KEY,
        } as MOSConfigInput
    }

    throw new Error(
        'Missing proxy configuration: set ORIGIN_URL, SURFACE_SLUG, and MONETIZATION_OS_SECRET_KEY, or provide a domain map',
    )
}

/**
 * Build the proxy handler for a given env. Call once at startup — a single MOS proxy instance
 * resolves per-request config via `withConfig` (static or `hostPathMatcher` in multi-domain mode).
 */
export function createProxyFetch(env: ProxyEnv): (request: Request) => Promise<Response> {
    const proxy = new MOSProxyBuilder()
        .withConfig(resolveConfigSource(env))
        .withUnresolvedConfigHandler(() => new Response('No proxy configuration for this host', { status: 404 }))
        .withOriginFetcher(createNodeOriginFetcher())
        .withApiFetcher(fetch)
        .withHtmlRewriter(new LolHtmlRewriterAdapter())
        .withClientMetadata(new WpVipGeoProvider())
        .withIdentityProvider(nodeIdentityProvider)
        .build()

    return (request) => proxy.handle(request)
}

/** Convenience wrapper for one-off calls (e.g. tests). For production use createProxyFetch(). */
export function proxyFetch(request: Request, env: ProxyEnv): Promise<Response> {
    return createProxyFetch(env)(request)
}
