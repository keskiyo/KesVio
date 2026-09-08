import { describe, expect, it } from 'vitest'
import { relativeTimeLabel } from '../../../src/shared/lib/relativeTime'

const now = new Date(2026, 8, 7, 12, 0, 0).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('relativeTimeLabel', () => {
	it('answers nothing for a moment that never happened', () => {
		expect(relativeTimeLabel(null, now)).toBeNull()
		expect(relativeTimeLabel(undefined, now)).toBeNull()
		expect(relativeTimeLabel(0, now)).toBeNull()
		expect(relativeTimeLabel(Number.NaN, now)).toBeNull()
	})

	it('names each distance in the unit that reads fastest', () => {
		expect(relativeTimeLabel(now - 30_000, now)).toBe('just now')
		expect(relativeTimeLabel(now - 5 * MINUTE, now)).toBe('5m ago')
		expect(relativeTimeLabel(now - 2 * HOUR, now)).toBe('2h ago')
		expect(relativeTimeLabel(now - 3 * DAY, now)).toBe('3d ago')
	})

	it('falls back to a date once relative distance stops meaning anything', () => {
		expect(relativeTimeLabel(now - 30 * DAY, now)).not.toMatch(/ago$/)
	})

	// A clock that moved backwards must not render "-3h ago".
	it('reads a stamp from the future as just now', () => {
		expect(relativeTimeLabel(now + HOUR, now)).toBe('just now')
	})
})
