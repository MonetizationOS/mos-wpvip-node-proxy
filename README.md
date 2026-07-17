<div align="center">
  <a href="https://monetizationos.com">
  <img alt="MonetizationOS logo" src="https://app.monetizationos.com/static/monetizationos-logo.png" height="48">
  </a>
  <h1>MonetizationOS WordPress VIP Node Proxy</h1>
</div>

[MonetizationOS](https://monetizationos.com) powers monetization for human and bot users alike. Use this Node.js proxy on [WordPress VIP](https://wpvip.com/) to sit in front of your origin, fetch surface decisions from the MOS API, and rewrite HTML responses with the appropriate content behaviors.

This proxy includes handling for both HTTP response modification and CSS-targeted Components for content modifications including: removal/truncation, displaying offerings, and custom messaging.

The shared proxy pipeline is provided by [`@monetizationos/proxy`](https://www.npmjs.com/package/@monetizationos/proxy). This repository contains the Node.js HTTP server entrypoint, environment variable mapping, and Node-specific adapters for `html-rewriter-wasm` and WordPress VIP client metadata.

Read more about using MonetizationOS at [docs.monetizationos.com](https://docs.monetizationos.com).

## Configuration

**By default, the proxy runs in single-domain mode.** Set `ORIGIN_URL`, `SURFACE_SLUG`, and the other variables in a local `.env` file (for development) or as WordPress VIP environment variables (for production). No domain map file is involved — `pnpm start` and `pnpm run dev` use env vars only.

**Multi-domain mode is optional.** Use it only when one Node.js process must proxy several public hostnames, each with its own origin, surface slug, and secret key. That requires opting in: pass `--domain-map ./config/domain-map.json` (or set `DOMAIN_MAP_FILE`) and use the sample [`config/domain-map.json`](config/domain-map.json) as a starting point. See [Multi-domain mode (optional)](#multi-domain-mode-optional).

The domain map file is **never** loaded automatically. If you do not pass `--domain-map` or set `DOMAIN_MAP_FILE`, the proxy always uses environment variables — even if `config/domain-map.json` exists in the repo.

## Required configuration (default)

Set these environment variables on WordPress VIP, or in a local `.env` file for development:

| Variable | Description |
|---|---|
| `MONETIZATION_OS_SECRET_KEY` | Your MonetizationOS secret key. [Get your secret key](https://docs.monetizationos.com/docs/guides/environments/managing-environments#api-keys). |
| `ORIGIN_URL` | The origin URL for your proxied website. |
| `SURFACE_SLUG` | The slug for the MonetizationOS surface you want to target. |
| `AUTHENTICATED_USER_JWT_COOKIE_NAME` | Cookie name for authenticated user JWT sessions. |
| `ANONYMOUS_SESSION_COOKIE_NAME` | Cookie name for anonymous sessions. |
| `INJECT_SCRIPT_URL` | URL of the MonetizationOS web components script to inject when component transforms run. |
| `MONETIZATION_OS_HOST` | MonetizationOS API host. Defaults to `https://api.monetizationos.com`. |
| `MONETIZATION_OS_ENDPOINTS_PREFIX` | Path prefix for proxied custom endpoints. Defaults to `/mos-endpoints/`. |

Copy [`.env.example`](.env.example) to `.env` locally and fill in the values above. On VIP, set the same variables with the CLI (see [Deploy to WordPress VIP](#deploy-to-wordpress-vip)).

## Optional: multi-domain mode

If you need multiple hostnames in one process, you do not need to set `ORIGIN_URL`, `SURFACE_SLUG`, or the global `MONETIZATION_OS_SECRET_KEY` — each domain is configured in the map. Follow [Multi-domain mode (optional)](#multi-domain-mode-optional) instead.

## Optional: paths that skip surface decisions

`SURFACE_DECISIONS_IGNORE_PATHS` is a comma-separated list of regular expressions. Matching pathnames still proxy to the origin and rewrite origin links, but skip MonetizationOS surface decisions and component transforms.

## Optional: cookies forwarded to surface decisions

`SURFACE_DECISIONS_COOKIES` is a comma-separated list of regular expressions. Cookie names matching any pattern are forwarded to the MonetizationOS surface-decisions API as `http.cookies`. Matching cookies are read from the incoming request `Cookie` header and from the origin response `Set-Cookie` headers; when the same name appears in both, the origin value is used. When unset or when no cookies match, `http.cookies` is omitted from the surface-decisions payload.

Example value:

```
^__session$, ^theme$, ^mos_
```

Each pattern is a regex tested against the cookie **name**. Plain names like `^__session$` match exactly; prefixes like `^mos_` match any cookie whose name starts with `mos_`.

## Optional: headers sent to the origin

`ORIGIN_REQUEST_HEADERS` adds or overrides outgoing headers on every upstream fetch to the origin. Set it to a JSON object mapping header names to values. Configured values override the same header from the client. Omit or leave empty when unused.

Example:

```json
{"X-Api-Key": "secret", "X-Custom": "my-value"}
```

## Commands

- `pnpm run build` — Compile TypeScript to `dist/`.
- `pnpm start` — Run the production server using **environment variables** (default).
- `pnpm run dev` — Local development: loads `.env` via `--env-file` (default).
- `pnpm run dev:multi-domain` — Local development with the optional domain map (see below).
- `pnpm test` — Run tests with Vitest.
- `pnpm run validate` — Run WordPress VIP preflight checks.

## Local development (default)

1. Install dependencies and create your local env file:

```bash
pnpm install
cp .env.example .env   # fill in ORIGIN_URL, SURFACE_SLUG, MONETIZATION_OS_SECRET_KEY, etc.
```

2. Build and start the dev server:

```bash
pnpm run build
pnpm run dev           # loads .env automatically via --env-file
```

The server listens on `http://localhost:8787` by default. Set `PORT` to override.

This is the normal setup: one domain, configured entirely through `.env`. You do not need `config/domain-map.json` unless you opt into multi-domain mode.

## Multi-domain mode (optional)

Only use this when a single Node.js process must proxy **multiple** public hostnames — each with its own upstream origin, MOS surface slug, and secret key. One `@monetizationos/proxy` instance handles all of them, resolving the right config per request via `MOSProxyBuilder.withConfig` and `hostPathMatcher`.

The repo includes a sample [`config/domain-map.json`](config/domain-map.json) you can adapt. To enable it:

```json
{
  "scripts": {
    "start": "node dist/server.js --domain-map ./config/domain-map.json"
  }
}
```

When multi-domain mode is enabled, `ORIGIN_URL`, `SURFACE_SLUG`, and the global `MONETIZATION_OS_SECRET_KEY` are not required — if they are set, they are ignored. Cookie names and other shared settings still come from environment variables.

**Local development** with the domain map:

```bash
# Uses config/domain-map.json; .env still supplies cookie names and per-domain secret values
pnpm run dev:multi-domain

# Or set DOMAIN_MAP_FILE in .env and run the default dev script:
# DOMAIN_MAP_FILE=./config/domain-map.json
```

If `--domain-map` or `DOMAIN_MAP_FILE` points at a path that does not exist, startup fails — the proxy does not fall back to single-domain env vars.

### Domain map file format

The file is a JSON object. Each **key** is the public hostname clients send in the `Host` header (port is ignored, casing is normalized). Each **value** provides that domain's origin, surface slug, and the **name of a VIP environment variable** that holds its MOS secret key. Secret values are never stored in the JSON file.

Example [`config/domain-map.json`](config/domain-map.json):

```json
{
  "mos-testing-node.go-vip.net": {
    "originUrl": "https://news.wingorigin.dev",
    "surfaceSlug": "web",
    "mosSecretKeyEnvVar": "MONETIZATION_OS_SECRET_KEY_WINGORIGIN"
  },
  "another.example.com": {
    "originUrl": "https://other-origin.example",
    "surfaceSlug": "other-web",
    "mosSecretKeyEnvVar": "MONETIZATION_OS_SECRET_KEY_OTHER"
  }
}
```

Field names can use either camelCase (`originUrl`, `surfaceSlug`, `mosSecretKeyEnvVar`) or env-var-style aliases (`ORIGIN_URL`, `SURFACE_SLUG`, `MONETIZATION_OS_SECRET_KEY_ENV`). Trailing slashes on `originUrl` are stripped.

At startup the proxy reads each `mosSecretKeyEnvVar` from the process environment. If a referenced VIP env var is missing, startup fails with a clear error.

### Per-domain secret keys on WordPress VIP

Set one VIP environment variable per site. The variable **names** are committed in `config/domain-map.json`; the **values** are configured only on VIP:

```bash
vip @mos-testing-node.production config envvar set MONETIZATION_OS_SECRET_KEY_WINGORIGIN
vip @mos-testing-node.production config envvar set MONETIZATION_OS_SECRET_KEY_OTHER
```

For local development, add the same variable names to your `.env` file:

```env
MONETIZATION_OS_SECRET_KEY_WINGORIGIN=sk_live_...
MONETIZATION_OS_SECRET_KEY_OTHER=sk_live_...
```

### How routing works

1. The HTTP server reconstructs the request URL from the incoming `Host` header (and `x-forwarded-proto` when present).
2. The hostname is matched against the domain map via `hostPathMatcher`.
3. A matching entry selects the `originUrl`, `surfaceSlug`, and resolved `mosSecretKey` passed into `@monetizationos/proxy` for that request.
4. If the hostname is not in the map, the proxy returns `404`.

Shared settings — cookie names, `INJECT_SCRIPT_URL`, `ORIGIN_REQUEST_HEADERS`, and so on — still come from environment variables and apply to every domain.

### Local testing with multiple hosts

Point different hostnames at `localhost` and send requests with the matching `Host` header:

```bash
# /etc/hosts (or equivalent)
# 127.0.0.1 mos-testing-node.go-vip.net another.example.com

curl -sI -H "Host: mos-testing-node.go-vip.net" http://localhost:8787/
curl -sI -H "Host: another.example.com" http://localhost:8787/
```

### Programmatic use

```ts
import { loadEnvFromProcess, createProxyFetch } from './index.js'

const env = loadEnvFromProcess({ domainMapFile: './domains.json' })
const handle = createProxyFetch(env)

export default {
  async fetch(request: Request) {
    return handle(request)
  },
}
```

Exports for custom integrations: `loadDomainMapFromFile`, `resolveRequestRouting`, `resolveOriginUrlForRequest`, `parseServerCliArgs`.

---

## Deploy to WordPress VIP

### Default: single domain

1. Set the variables from [Required configuration (default)](#required-configuration-default) on your VIP environment.
2. Deploy via your normal GitHub → VIP workflow. VIP runs `pnpm start`, which uses env vars — no domain map.
3. Route your hostname to this Node.js application in the VIP dashboard.

Use the VIP CLI to set each variable:

```bash
vip @mos-testing-node.production config envvar set ORIGIN_URL
vip @mos-testing-node.production config envvar set SURFACE_SLUG
vip @mos-testing-node.production config envvar set ANONYMOUS_SESSION_COOKIE_NAME
vip @mos-testing-node.production config envvar set AUTHENTICATED_USER_JWT_COOKIE_NAME
vip @mos-testing-node.production config envvar set MONETIZATION_OS_SECRET_KEY
vip @mos-testing-node.production config envvar set MONETIZATION_OS_HOST
vip @mos-testing-node.production config envvar set MONETIZATION_OS_ENDPOINTS_PREFIX
vip @mos-testing-node.production config envvar set INJECT_SCRIPT_URL
vip @mos-testing-node.production config envvar set SURFACE_DECISIONS_IGNORE_PATHS
vip @mos-testing-node.production config envvar set SURFACE_DECISIONS_COOKIES
vip @mos-testing-node.production config envvar set ORIGIN_REQUEST_HEADERS
```

To review what is currently set:

```bash
vip @mos-testing-node.production config envvar get SURFACE_SLUG
vip @mos-testing-node.production config envvar list
```

### Optional: multi-domain on VIP

Only if you opted into [Multi-domain mode (optional)](#multi-domain-mode-optional):

1. Commit your `config/domain-map.json` to the repository.
2. Change `start` in `package.json` to `"node dist/server.js --domain-map ./config/domain-map.json"`.
3. Deploy via GitHub → VIP. You do not need to set `ORIGIN_URL`, `SURFACE_SLUG`, or the global `MONETIZATION_OS_SECRET_KEY` — each domain is configured in the map.
4. Route each hostname in the map to this Node.js application.
5. Set each per-domain secret env var named in `mosSecretKeyEnvVar` via the VIP CLI.

Cookie names and other shared settings still use VIP environment variables — only origins, surface slugs, and secret key *names* are file-based.

### Purge the cache

Purge a single URL:

```bash
vip @mos-testing-node.production cache purge-url https://mos-testing-node.go-vip.net/
```

Purge a specific path:

```bash
vip @mos-testing-node.production cache purge-url https://mos-testing-node.go-vip.net/some/path/
```

---

## Further reading

- [WordPress VIP Node.js documentation](https://docs.wpvip.com/technical-references/node-js/)
- [VIP CLI reference](https://docs.wpvip.com/vip-cli/)
