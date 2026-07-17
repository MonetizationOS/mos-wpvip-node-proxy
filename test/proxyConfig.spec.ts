import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProxyEnv } from '../src/env'
import { proxyFetch } from '../src/proxyHandler'
import { installProxyFetchMock } from './helpers'

const baseEnv: ProxyEnv = {
    ORIGIN_URL: 'https://origin.example',
    SURFACE_SLUG: 'web',
    AUTHENTICATED_USER_JWT_COOKIE_NAME: 'jwt-cookie',
    ANONYMOUS_SESSION_COOKIE_NAME: 'anon-session',
    MONETIZATION_OS_SECRET_KEY: 'sk_test_123_key.payload',
}

describe('proxy config', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('prepends the origin pathname and rewrites base-path origin links', async () => {
        installProxyFetchMock({
            originPath: '/base/foo/bar',
            originBody: '<body><a href="https://origin.example/base/link">Link</a></body>',
        })

        const res = await proxyFetch(
            new Request('https://test.example/foo/bar?baz=1'),
            { ...baseEnv, ORIGIN_URL: 'https://origin.example/base/' },
        )

        expect(res.status).toBe(200)
        const text = await res.text()
        expect(text).toContain('https://test.example/link')
        expect(text).not.toContain('https://origin.example/base/link')
    })

    it('forwards requests matching MONETIZATION_OS_ENDPOINTS_PREFIX to the MOS API', async () => {
        const { fetchMock } = installProxyFetchMock()

        const res = await proxyFetch(new Request('https://test.example/mos-endpoints/foo/bar'), baseEnv)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
        expect(fetchMock.mock.calls.some(([urlOrRequest]) => {
            const url = urlOrRequest instanceof Request ? urlOrRequest.url : String(urlOrRequest)
            return url.includes('/api/v1/envs/test_123/endpoints/foo/bar')
        })).toBe(true)
    })

    it('forwards matching cookies to surface decisions when SURFACE_DECISIONS_COOKIES is set', async () => {
        const { surfaceDecisionsBodies } = installProxyFetchMock({
            originResponseHeaders: { 'Set-Cookie': 'theme=from-origin; Path=/' },
        })

        const res = await proxyFetch(
            new Request('https://test.example/index.html', {
                headers: { Cookie: 'jwt-cookie=request-jwt; theme=old; ignored=1' },
            }),
            { ...baseEnv, SURFACE_DECISIONS_COOKIES: '^jwt-cookie$, ^theme$' },
        )

        expect(res.status).toBe(200)
        expect(surfaceDecisionsBodies[0]).toMatchObject({
            http: {
                cookies: {
                    'jwt-cookie': 'request-jwt',
                    theme: 'from-origin',
                },
            },
        })
    })

    it('merges configured origin request headers and preserves untouched client headers', async () => {
        const { fetchMock } = installProxyFetchMock({
            originPath: '/page.json',
            originBody: { success: true },
        })

        const res = await proxyFetch(
            new Request('https://test.example/page.json', {
                headers: { 'X-Override': 'from-client', 'X-Keep': 'client-value' },
            }),
            { ...baseEnv, ORIGIN_REQUEST_HEADERS: '{"X-Api-Key":"secret","X-Override":"from-env"}' },
        )

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true })

        const originCall = fetchMock.mock.calls.find(([urlOrRequest]) => {
            const url = urlOrRequest instanceof Request ? urlOrRequest.url : String(urlOrRequest)
            return url.startsWith('https://origin.example')
        })
        expect(originCall).toBeDefined()
        if (!originCall) throw new Error('origin fetch was not made')

        const originRequest = originCall[0] instanceof Request ? originCall[0] : new Request(originCall[0], originCall[1])
        expect(originRequest.headers.get('x-api-key')).toBe('secret')
        expect(originRequest.headers.get('x-override')).toBe('from-env')
        expect(originRequest.headers.get('x-keep')).toBe('client-value')
    })

    it.each([
        { anonymousIdentifier: undefined, userJwt: undefined, expectedIdentity: { createAnonymousIdentifier: true } },
        { anonymousIdentifier: 'anon-id', userJwt: undefined, expectedIdentity: { anonymousIdentifier: 'anon-id' } },
        {
            anonymousIdentifier: undefined,
            userJwt: 'user-jwt',
            expectedIdentity: { userJwt: 'user-jwt', createAnonymousIdentifierFallback: true },
        },
        {
            anonymousIdentifier: 'anon-id',
            userJwt: 'user-jwt',
            expectedIdentity: { userJwt: 'user-jwt', createAnonymousIdentifierFallback: true },
        },
    ])('sends the expected identity for %s', async ({ anonymousIdentifier, userJwt, expectedIdentity }) => {
        const { surfaceDecisionsBodies } = installProxyFetchMock({
            originBody: '<html><head></head><body>ok</body></html>',
        })

        const cookieParts = [
            anonymousIdentifier ? `anon-session=${anonymousIdentifier}` : undefined,
            userJwt ? `jwt-cookie=${userJwt}` : undefined,
        ].filter(Boolean)

        await proxyFetch(
            new Request('https://test.example/index.html', {
                headers: cookieParts.length ? { Cookie: `${cookieParts.join('; ')};` } : undefined,
            }),
            baseEnv,
        )

        expect(surfaceDecisionsBodies[0]).toMatchObject({ identity: expectedIdentity })
    })
})
