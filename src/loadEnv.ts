import type { ProxyEnv } from './env.js'
import { loadDomainMapFromFile } from './domainMap.js'

export interface LoadEnvOptions {
    /** Path to a JSON domain map file. Overrides `DOMAIN_MAP_FILE` from the environment. */
    domainMapFile?: string
}

/** Build {@link ProxyEnv} from `process.env` (e.g. for the sample HTTP server). */
export function loadEnvFromProcess(options: LoadEnvOptions = {}): ProxyEnv {
    const required = (key: string): string => {
        const v = process.env[key]
        if (v === undefined || v === '') {
            throw new Error(`Missing required environment variable: ${key}`)
        }
        return v
    }

    const domainMapFile = options.domainMapFile ?? process.env.DOMAIN_MAP_FILE
    const domainMap = domainMapFile ? loadDomainMapFromFile(domainMapFile) : undefined

    const shared = {
        AUTHENTICATED_USER_JWT_COOKIE_NAME: required('AUTHENTICATED_USER_JWT_COOKIE_NAME'),
        ANONYMOUS_SESSION_COOKIE_NAME: required('ANONYMOUS_SESSION_COOKIE_NAME'),
        INJECT_SCRIPT_URL: process.env.INJECT_SCRIPT_URL,
        MONETIZATION_OS_HOST: process.env.MONETIZATION_OS_HOST,
        MONETIZATION_OS_ENDPOINTS_PREFIX: process.env.MONETIZATION_OS_ENDPOINTS_PREFIX,
        SURFACE_DECISIONS_IGNORE_PATHS: process.env.SURFACE_DECISIONS_IGNORE_PATHS,
        SURFACE_DECISIONS_COOKIES: process.env.SURFACE_DECISIONS_COOKIES,
        ORIGIN_REQUEST_HEADERS: process.env.ORIGIN_REQUEST_HEADERS,
    }

    if (domainMap) {
        return {
            ...shared,
            domainMap,
        }
    }

    return {
        ...shared,
        ORIGIN_URL: required('ORIGIN_URL'),
        SURFACE_SLUG: required('SURFACE_SLUG'),
        MONETIZATION_OS_SECRET_KEY: required('MONETIZATION_OS_SECRET_KEY'),
    }
}
