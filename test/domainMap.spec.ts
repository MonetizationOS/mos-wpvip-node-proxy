import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    loadDomainMapFromFile,
    lookupDomainEntry,
    normalizeHostname,
    resolveDomainMapSecrets,
} from '../src/domainMap'

describe('domainMap', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('normalizes hostnames by stripping port and lowercasing', () => {
        expect(normalizeHostname('Example.COM:443')).toBe('example.com')
    })

    it('loads and resolves secrets from VIP env vars named in the map', () => {
        const dir = mkdtempSync(join(tmpdir(), 'domain-map-'))
        const filePath = join(dir, 'domains.json')
        writeFileSync(
            filePath,
            JSON.stringify({
                'Proxy.Example:8787': {
                    ORIGIN_URL: 'https://origin.example/',
                    SURFACE_SLUG: 'web',
                    MONETIZATION_OS_SECRET_KEY_ENV: 'MOS_SECRET_PROXY_EXAMPLE',
                },
            }),
        )

        expect(
            loadDomainMapFromFile(filePath, {
                MOS_SECRET_PROXY_EXAMPLE: 'sk_test_example',
            }),
        ).toStrictEqual({
            'proxy.example': {
                originUrl: 'https://origin.example',
                surfaceSlug: 'web',
                mosSecretKeyEnvVar: 'MOS_SECRET_PROXY_EXAMPLE',
                mosSecretKey: 'sk_test_example',
            },
        })
    })

    it('fails when a referenced secret env var is missing', () => {
        expect(() =>
            resolveDomainMapSecrets({
                'proxy.example': {
                    originUrl: 'https://origin.example',
                    surfaceSlug: 'web',
                    mosSecretKeyEnvVar: 'MOS_SECRET_MISSING',
                },
            }, {}),
        ).toThrow(/MOS_SECRET_MISSING/)
    })

    it('rejects invalid domain map files', () => {
        const dir = mkdtempSync(join(tmpdir(), 'domain-map-'))
        const filePath = join(dir, 'invalid.json')
        writeFileSync(filePath, '[]')

        expect(() => loadDomainMapFromFile(filePath)).toThrow(/must be a JSON object/)
    })

    it('looks up entries by request hostname', () => {
        const domainMap = {
            'proxy.example': {
                originUrl: 'https://origin.example',
                surfaceSlug: 'web',
                mosSecretKeyEnvVar: 'MOS_SECRET_PROXY_EXAMPLE',
                mosSecretKey: 'sk_test_example',
            },
        }

        expect(lookupDomainEntry(domainMap, 'https://Proxy.Example:8787/page')).toStrictEqual({
            originUrl: 'https://origin.example',
            surfaceSlug: 'web',
            mosSecretKeyEnvVar: 'MOS_SECRET_PROXY_EXAMPLE',
            mosSecretKey: 'sk_test_example',
        })
        expect(lookupDomainEntry(domainMap, 'https://unknown.example/')).toBeUndefined()
    })
})
