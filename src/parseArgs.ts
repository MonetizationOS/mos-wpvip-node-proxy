/** CLI flags for the sample HTTP server. Env vars take precedence unless overridden by flags. */
export interface ServerCliOptions {
    domainMapFile?: string
}

/**
 * Parse `--domain-map <path>` or `--domain-map=<path>` from `process.argv`.
 * Does not mutate `process.env`; callers merge with `DOMAIN_MAP_FILE` as needed.
 */
export function parseServerCliArgs(argv: string[] = process.argv.slice(2)): ServerCliOptions {
    const options: ServerCliOptions = {}

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '--domain-map') {
            const value = argv[i + 1]
            if (!value || value.startsWith('-')) {
                throw new Error('--domain-map requires a file path argument')
            }
            options.domainMapFile = value
            i++
            continue
        }
        if (arg.startsWith('--domain-map=')) {
            const value = arg.slice('--domain-map='.length)
            if (!value) {
                throw new Error('--domain-map requires a file path argument')
            }
            options.domainMapFile = value
        }
    }

    return options
}
