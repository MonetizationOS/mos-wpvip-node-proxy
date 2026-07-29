import { describe, expect, it } from 'vitest'
import { isEnvFlagEnabled } from '../src/envFlags'

describe('isEnvFlagEnabled', () => {
    it.each(['1', 'true', 'TRUE', ' yes ', 'Yes'])('treats %j as enabled', (value) => {
        expect(isEnvFlagEnabled(value)).toBe(true)
    })

    it.each([undefined, '', '0', 'false', 'no', 'on'])('treats %j as disabled', (value) => {
        expect(isEnvFlagEnabled(value)).toBe(false)
    })
})
