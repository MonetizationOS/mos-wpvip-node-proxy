import type { ProxyEnv } from './env.js'
import { lookupDomainEntry } from './domainMap.js'

export interface DomainRouting {
    originUrl: string
    surfaceSlug: string
    mosSecretKey: string
}

/** Resolve per-request origin, surface slug, and MOS secret key from env or domain map. */
export function resolveRequestRouting(env: ProxyEnv, request: Request): DomainRouting | undefined {
    if (env.domainMap) {
        const entry = lookupDomainEntry(env.domainMap, request.url)
        if (!entry) return undefined
        return {
            originUrl: entry.originUrl,
            surfaceSlug: entry.surfaceSlug,
            mosSecretKey: entry.mosSecretKey,
        }
    }

    if (env.ORIGIN_URL && env.SURFACE_SLUG && env.MONETIZATION_OS_SECRET_KEY) {
        return {
            originUrl: env.ORIGIN_URL,
            surfaceSlug: env.SURFACE_SLUG,
            mosSecretKey: env.MONETIZATION_OS_SECRET_KEY,
        }
    }

    return undefined
}

/** Resolve the origin URL for a request (used by the HTTP server for scheme fallback). */
export function resolveOriginUrlForRequest(env: ProxyEnv, requestUrl: string | URL): string | undefined {
    return resolveRequestRouting(env, new Request(requestUrl))?.originUrl
}
