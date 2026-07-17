/**
 * WordPress VIP request headers → `cdn` payload for the MonetizationOS API.
 *
 * Two sets of headers are captured:
 *
 * Geolocation (powered by Maxmind GeoIP®, injected by the VIP edge cache):
 * https://docs.wpvip.com/caching/page-cache/customize-behavior/ip-geolocation/
 *
 * Platform headers (passed through to the origin application by VIP):
 * https://docs.wpvip.com/caching/page-cache/http-headers/added-by-vip/
 */

export interface WpVipGeo {
    // --- Geolocation ---
    continent?: string
    country?: string
    /** ISO 3166-2 first-level subdivision code (e.g. "VA"). */
    regionCode?: string
    city?: string
    postalCode?: string
    /** Only meaningful for US locations; consistent with Google AdWords metro codes. */
    metroCode?: string

    // --- Platform headers ---
    /** Autonomous System Number — identifies the network provider of the requester. */
    asn?: string
    /** Best-guess true client IP, accounting for reverse proxies and CDNs. */
    clientIp?: string
    /** JA3 SSL/TLS fingerprint of the connecting client. */
    ja3Hash?: string
    /** Unique ID assigned to every incoming request at the VIP edge. */
    requestId?: string
    /** VIP device classification derived from User-Agent: "desktop" | "tablet" | "smart" | "dumb". */
    mobileClass?: string
}

/**
 * Read WP VIP request headers and return a `WpVipGeo` object.
 * Returns `undefined` when none of the expected headers are present so the
 * caller can skip attaching an empty object to the payload.
 */
export function wpvipGeoFromHeaders(headers: Headers): WpVipGeo | undefined {
    const continent = headers.get('x-continent') ?? undefined
    const country = headers.get('x-country-code') ?? undefined
    const regionCode = headers.get('x-region') ?? undefined
    const city = headers.get('x-city') ?? undefined
    const postalCode = headers.get('x-postal-code') ?? undefined
    const metroCode = headers.get('x-metro-code') ?? undefined

    const asn = headers.get('x-asn') ?? undefined
    const ja3Hash = headers.get('x-ja3-hash') ?? undefined
    const requestId = headers.get('x-request-id') ?? undefined
    const mobileClass = headers.get('x-mobile-class') ?? undefined

    const hasAnyValue =
        continent || country || regionCode || city || postalCode || metroCode ||
        asn || ja3Hash || requestId || mobileClass

    if (!hasAnyValue) {
        return undefined
    }

    return {
        ...(continent && { continent }),
        ...(country && { country }),
        ...(regionCode && { regionCode }),
        ...(city && { city }),
        ...(postalCode && { postalCode }),
        ...(metroCode && { metroCode }),
        ...(asn && { asn }),
        ...(ja3Hash && { ja3Hash }),
        ...(requestId && { requestId }),
        ...(mobileClass && { mobileClass }),
    }
}
