import type { ClientMetadataProvider } from '@monetizationos/proxy'
import { wpvipGeoFromHeaders } from '../wpvipGeo.js'

/**
 * Supplies WordPress VIP geo/platform headers to the surface-decisions API payload.
 * Geo data is exposed as `cdn` (and `wpvip` for backward compatibility).
 */
export class WpVipGeoProvider implements ClientMetadataProvider {
    build(request: Request): Record<string, unknown> {
        const wpvip = wpvipGeoFromHeaders(request.headers)
        return wpvip ? { wpvip, cdn: wpvip } : {}
    }
}
