import {
    defaultPersistIdentity,
    defaultResolveIdentity,
    type IdentityProvider,
} from '@monetizationos/proxy'

/** Explicit default cookie/origin identity resolution for the Node proxy. */
export const nodeIdentityProvider: IdentityProvider = {
    resolve: defaultResolveIdentity,
    persist: defaultPersistIdentity,
}
