import type { DomainMap } from './domainMap.js'

/** Environment/config matching Cloudflare Worker bindings (loaded from env vars or passed in). */
export interface ProxyEnv {
    /** Required in single-domain mode; omitted when `domainMap` is set. */
    ORIGIN_URL?: string
    /** Required in single-domain mode; omitted when `domainMap` is set. */
    SURFACE_SLUG?: string
    /** When set, routes requests by Host to per-domain origin and surface slug. */
    domainMap?: DomainMap
    AUTHENTICATED_USER_JWT_COOKIE_NAME: string
    ANONYMOUS_SESSION_COOKIE_NAME: string
    INJECT_SCRIPT_URL?: string
    MONETIZATION_OS_HOST?: string
    MONETIZATION_OS_ENDPOINTS_PREFIX?: string
    /** Required in single-domain mode; omitted when each domain map entry supplies its own secret. */
    MONETIZATION_OS_SECRET_KEY?: string
    SURFACE_DECISIONS_IGNORE_PATHS?: string
    /** Comma-separated regex patterns for cookie names forwarded to surface decisions as http.cookies. */
    SURFACE_DECISIONS_COOKIES?: string
    /** JSON object string of extra headers merged into every upstream origin request (e.g. `{"X-Api-Key":"secret"}`). */
    ORIGIN_REQUEST_HEADERS?: string
}
