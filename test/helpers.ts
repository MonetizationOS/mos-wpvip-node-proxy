import type { SurfaceDecisionResponse } from '@monetizationos/proxy'
import { vi } from 'vitest'

export const surfaceDecisionsResponse: SurfaceDecisionResponse = {
    status: 'success',
    identity: { identifier: 'id', isAuthenticated: false, authType: 'anonymous', jwtClaims: {} },
    features: {},
    customer: { hasProducts: false },
    surfaceBehavior: {},
    componentsSkipped: false,
    componentBehaviors: {},
}

type MockFetchOptions = {
    originPath?: string
    originStatus?: number
    originBody?: string | object
    originContentType?: string
    originResponseHeaders?: Record<string, string>
    surfaceDecisionsStatus?: number
    surfaceDecisionsResponse?: Partial<SurfaceDecisionResponse>
}

export function installProxyFetchMock({
    originPath = '/index.html',
    originStatus = 200,
    originBody = '<body><head></head><h1>Test</h1></body>',
    originContentType = 'text/html',
    originResponseHeaders = {},
    surfaceDecisionsStatus = 200,
    surfaceDecisionsResponse: surfaceDecisionsOverrides,
}: MockFetchOptions = {}) {
    const surfaceDecisionsBodies: unknown[] = []
    const fetchMock = vi.fn().mockImplementation((urlOrRequest: Request | string, init?: RequestInit) => {
        const url = urlOrRequest instanceof Request ? urlOrRequest.url : String(urlOrRequest)
        const requestInit = urlOrRequest instanceof Request ? undefined : init

        if (url.startsWith('https://origin.example')) {
            const parsed = new URL(url)
            if (parsed.pathname !== originPath) {
                return Promise.resolve(new Response('not found', { status: 404 }))
            }

            const body =
                originBody !== null && typeof originBody === 'object'
                    ? JSON.stringify(originBody)
                    : String(originBody)
            const contentType =
                originBody !== null && typeof originBody === 'object' ? 'application/json' : originContentType

            return Promise.resolve(
                new Response(body, {
                    status: originStatus,
                    headers: { 'Content-Type': contentType, ...originResponseHeaders },
                }),
            )
        }

        if (url.includes('https://api.monetizationos.com')) {
            const bodySource = urlOrRequest instanceof Request ? urlOrRequest : new Request(url, requestInit)
            return bodySource.clone().text().then((bodyText) => {
                const parsed = new URL(url)
                if (parsed.pathname === '/api/v1/surface-decisions' && bodyText) {
                    surfaceDecisionsBodies.push(JSON.parse(bodyText))
                    return new Response(JSON.stringify({ ...surfaceDecisionsResponse, ...surfaceDecisionsOverrides }), {
                        status: surfaceDecisionsStatus,
                        headers: { 'Content-Type': 'application/json' },
                    })
                }

                const payload = parsed.pathname.includes('/api/v1/envs/') ? { ok: true } : { success: true }
                return new Response(JSON.stringify(payload), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            })
        }

        return Promise.resolve(new Response('unexpected fetch', { status: 500 }))
    })

    vi.stubGlobal('fetch', fetchMock)
    return { fetchMock, surfaceDecisionsBodies }
}
