import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Per-domain origin, surface slug, and MOS secret key entry in a domain map JSON file. */
export interface DomainMapEntry {
    originUrl: string
    surfaceSlug: string
    /** VIP environment variable name that stores this domain's MOS secret key. */
    mosSecretKeyEnvVar: string
    /** Resolved at startup from `process.env[mosSecretKeyEnvVar]`. */
    mosSecretKey: string
}

/** Hostname (lowercase, no port) -> domain config. */
export type DomainMap = Record<string, DomainMapEntry>

type RawDomainMapEntry = {
    originUrl?: string
    surfaceSlug?: string
    mosSecretKeyEnvVar?: string
    ORIGIN_URL?: string
    SURFACE_SLUG?: string
    MONETIZATION_OS_SECRET_KEY_ENV?: string
}

function normalizeEntry(host: string, raw: RawDomainMapEntry): Omit<DomainMapEntry, 'mosSecretKey'> {
    const originUrl = raw.originUrl ?? raw.ORIGIN_URL
    const surfaceSlug = raw.surfaceSlug ?? raw.SURFACE_SLUG
    const mosSecretKeyEnvVar = raw.mosSecretKeyEnvVar ?? raw.MONETIZATION_OS_SECRET_KEY_ENV

    if (!originUrl || originUrl === '') {
        throw new Error(`Domain map entry for "${host}" is missing originUrl (or ORIGIN_URL)`)
    }
    if (!surfaceSlug || surfaceSlug === '') {
        throw new Error(`Domain map entry for "${host}" is missing surfaceSlug (or SURFACE_SLUG)`)
    }
    if (!mosSecretKeyEnvVar || mosSecretKeyEnvVar === '') {
        throw new Error(
            `Domain map entry for "${host}" is missing mosSecretKeyEnvVar (or MONETIZATION_OS_SECRET_KEY_ENV)`,
        )
    }

    let parsedOrigin: URL
    try {
        parsedOrigin = new URL(originUrl)
    } catch {
        throw new Error(`Domain map entry for "${host}" has invalid originUrl: ${originUrl}`)
    }

    return {
        originUrl: parsedOrigin.href.replace(/\/$/, '') || parsedOrigin.href,
        surfaceSlug,
        mosSecretKeyEnvVar,
    }
}

/** Strip port and lowercase for consistent Host header lookups. */
export function normalizeHostname(host: string): string {
    const lower = host.toLowerCase()

    // Bracketed IPv6 literal, optionally with a port (e.g. "[::1]:8787").
    if (lower.startsWith('[')) {
        const end = lower.indexOf(']')
        return end === -1 ? lower : lower.slice(1, end)
    }

    // Strip :port only when there's exactly one ':' (e.g. example.com:443, 127.0.0.1:8787).
    const match = lower.match(/^(.*):(\d+)$/)
    if (match && match[1].indexOf(':') === -1) return match[1]

    // IPv6 literals from URL.hostname contain ':' but no port.
    return lower
}

/** Resolve a domain map entry from a request URL's hostname. */
export function lookupDomainEntry(domainMap: DomainMap, requestUrl: string | URL): DomainMapEntry | undefined {
    const hostname = normalizeHostname(new URL(requestUrl).hostname)
    return domainMap[hostname]
}

/**
 * Resolve each domain's MOS secret key from the VIP env var named in the map.
 * Fails fast when a referenced env var is missing or empty.
 */
export function resolveDomainMapSecrets(
    domainMap: Record<string, Omit<DomainMapEntry, 'mosSecretKey'>>,
    env: NodeJS.ProcessEnv = process.env,
): DomainMap {
    const resolved: DomainMap = {}

    for (const [host, entry] of Object.entries(domainMap)) {
        const mosSecretKey = env[entry.mosSecretKeyEnvVar]
        if (mosSecretKey === undefined || mosSecretKey === '') {
            throw new Error(
                `Missing required environment variable "${entry.mosSecretKeyEnvVar}" for domain "${host}"`,
            )
        }

        resolved[host] = {
            ...entry,
            mosSecretKey,
        }
    }

    return resolved
}

/**
 * Parse and validate a domain map JSON file.
 * Keys are hostnames; values provide origin, surface slug, and a VIP env var name for the MOS secret key.
 */
export function loadDomainMapFromFile(filePath: string, env: NodeJS.ProcessEnv = process.env): DomainMap {
    const absolutePath = resolve(filePath)
    let parsed: unknown
    try {
        parsed = JSON.parse(readFileSync(absolutePath, 'utf8'))
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to read domain map file "${absolutePath}": ${message}`)
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Domain map file "${absolutePath}" must be a JSON object`)
    }

    const unresolved: Record<string, Omit<DomainMapEntry, 'mosSecretKey'>> = {}
for (const [host, raw] of Object.entries(parsed as Record<string, RawDomainMapEntry>)) {
    const normalizedHost = normalizeHostname(host)
    if (!normalizedHost) {
        throw new Error(`Domain map file "${absolutePath}" contains an empty hostname key`)
    }
    if (unresolved[normalizedHost]) {
        throw new Error(
            `Domain map file "${absolutePath}" contains duplicate hostname "${normalizedHost}" after normalization`,
        )
    }
    unresolved[normalizedHost] = normalizeEntry(normalizedHost, raw ?? {})
}

    if (Object.keys(unresolved).length === 0) {
        throw new Error(`Domain map file "${absolutePath}" must contain at least one domain`)
    }

    return resolveDomainMapSecrets(unresolved, env)
}
