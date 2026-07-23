import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadEnvFromProcess } from '../src/loadEnv'

describe('loadEnvFromProcess', () => {
    const baseEnv = {
        ORIGIN_URL: 'https://origin.example',
        SURFACE_SLUG: 'web',
        ANONYMOUS_SESSION_COOKIE_NAME: 'anon-session',
        AUTHENTICATED_USER_JWT_COOKIE_NAME: 'jwt-cookie',
        MONETIZATION_OS_SECRET_KEY: 'sk_test',
    }

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('requires ORIGIN_URL and SURFACE_SLUG in single-domain mode', () => {
        vi.stubEnv('ANONYMOUS_SESSION_COOKIE_NAME', baseEnv.ANONYMOUS_SESSION_COOKIE_NAME)
        vi.stubEnv('AUTHENTICATED_USER_JWT_COOKIE_NAME', baseEnv.AUTHENTICATED_USER_JWT_COOKIE_NAME)
        vi.stubEnv('MONETIZATION_OS_SECRET_KEY', baseEnv.MONETIZATION_OS_SECRET_KEY)

        expect(() => loadEnvFromProcess()).toThrow(/ORIGIN_URL/)
    })

    it('loads shared env vars in single-domain mode', () => {
        for (const [key, value] of Object.entries(baseEnv)) {
            vi.stubEnv(key, value)
        }

        expect(loadEnvFromProcess()).toMatchObject({
            ORIGIN_URL: baseEnv.ORIGIN_URL,
            SURFACE_SLUG: baseEnv.SURFACE_SLUG,
            MONETIZATION_OS_SECRET_KEY: baseEnv.MONETIZATION_OS_SECRET_KEY,
        })
    })

    it('loads a domain map and resolves per-domain secret env vars', () => {
        const dir = mkdtempSync(join(tmpdir(), 'domain-map-'))
        const filePath = join(dir, 'domains.json')
        writeFileSync(
            filePath,
            JSON.stringify({
                'proxy.example': {
                    originUrl: 'https://origin.example',
                    surfaceSlug: 'web',
                    mosSecretKeyEnvVar: 'MOS_SECRET_PROXY_EXAMPLE',
                },
            }),
        )

        vi.stubEnv('ANONYMOUS_SESSION_COOKIE_NAME', baseEnv.ANONYMOUS_SESSION_COOKIE_NAME)
        vi.stubEnv('AUTHENTICATED_USER_JWT_COOKIE_NAME', baseEnv.AUTHENTICATED_USER_JWT_COOKIE_NAME)
        vi.stubEnv('MOS_SECRET_PROXY_EXAMPLE', 'sk_test_site')

        const env = loadEnvFromProcess({ domainMapFile: filePath })

        expect(env.ORIGIN_URL).toBeUndefined()
        expect(env.SURFACE_SLUG).toBeUndefined()
        expect(env.MONETIZATION_OS_SECRET_KEY).toBeUndefined()
        expect(env.domainMap).toStrictEqual({
            'proxy.example': {
                originUrl: 'https://origin.example',
                surfaceSlug: 'web',
                mosSecretKeyEnvVar: 'MOS_SECRET_PROXY_EXAMPLE',
                mosSecretKey: 'sk_test_site',
            },
        })
    })
})
