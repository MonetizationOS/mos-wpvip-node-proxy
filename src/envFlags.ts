/** Truthy VIP/env flag values: `1`, `true`, `yes` (case-insensitive). */
export function isEnvFlagEnabled(value: string | undefined): boolean {
    if (value === undefined || value === '') {
        return false
    }
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
}
