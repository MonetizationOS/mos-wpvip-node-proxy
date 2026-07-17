import { describe, expect, it } from 'vitest'
import type { ProxyEnv } from '../src/env'
import { resolveOriginUrlForRequest, resolveRequestRouting } from '../src/requestRouting'

const sharedEnv = {
    AUTHENTICATED_USER_JWT_COOKIE_NAME: 'jwt-cookie',
    ANONYMOUS_SESSION_COOKIE_NAME: 'anon-session',
}

describe('requestRouting', () => {
    it('resolves routing from ORIGIN_URL and SURFACE_SLUG in single-domain mode', () => {
        const env: ProxyEnv = {
            ...sharedEnv,
            ORIGIN_URL: 'https://origin.example',
            SURFACE_SLUG: 'web',
            MONETIZATION_OS_SECRET_KEY: 'sk_test_123_key.payload',
        }

        expect(resolveRequestRouting(env, new Request('https://proxy.example/page'))).toStrictEqual({
            originUrl: 'https://origin.example',
            surfaceSlug: 'web',
            mosSecretKey: 'sk_test_123_key.payload',
        })
        expect(resolveOriginUrlForRequest(env, 'https://proxy.example/page')).toBe('https://origin.example')
    })

    it('resolves routing from the domain map in multi-domain mode', () => {
        const env: ProxyEnv = {
            ...sharedEnv,
            domainMap: {
                'proxy-a.example': {
                    originUrl: 'https://origin-a.example',
                    surfaceSlug: 'surface-a',
                    mosSecretKeyEnvVar: 'MOS_SECRET_A',
                    mosSecretKey: 'sk_test_a',
                },
                'proxy-b.example': {
                    originUrl: 'https://origin-b.example',
                    surfaceSlug: 'surface-b',
                    mosSecretKeyEnvVar: 'MOS_SECRET_B',
                    mosSecretKey: 'sk_test_b',
                },
            },
        }

        expect(resolveRequestRouting(env, new Request('https://proxy-a.example/page'))).toStrictEqual({
            originUrl: 'https://origin-a.example',
            surfaceSlug: 'surface-a',
            mosSecretKey: 'sk_test_a',
        })
        expect(resolveRequestRouting(env, new Request('https://proxy-b.example/page'))).toStrictEqual({
            originUrl: 'https://origin-b.example',
            surfaceSlug: 'surface-b',
            mosSecretKey: 'sk_test_b',
        })
    })

    it('returns undefined for unknown hosts in multi-domain mode', () => {
        const env: ProxyEnv = {
            ...sharedEnv,
            domainMap: {
                'proxy.example': {
                    originUrl: 'https://origin.example',
                    surfaceSlug: 'web',
                    mosSecretKeyEnvVar: 'MOS_SECRET_PROXY_EXAMPLE',
                    mosSecretKey: 'sk_test_example',
                },
            },
        }

        expect(resolveRequestRouting(env, new Request('https://unknown.example/'))).toBeUndefined()
        expect(resolveOriginUrlForRequest(env, 'https://unknown.example/')).toBeUndefined()
    })
})
