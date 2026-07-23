import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['test/**/*.spec.ts'],
        server: {
            deps: {
                inline: ['@monetizationos/proxy'],
            },
        },
    },
})
