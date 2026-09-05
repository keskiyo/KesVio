import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	automaticCheckIsDue,
	dismissedVersion,
	failedChecks,
	rememberAutomaticChecks,
	rememberCheck,
	rememberDismissedVersion,
	rememberFailedChecks,
	storedAutomaticChecks,
} from '../../../../src/features/update-app/model/updatePreferences'

beforeEach(() => {
	vi.restoreAllMocks()
	localStorage.clear()
})

describe('update preferences', () => {
	it('checks at the four-hour boundary and caps repeated failures at a day', () => {
		const start = 1_000_000
		rememberCheck(start)
		expect(automaticCheckIsDue(start + 4 * 3600000 - 1)).toBe(false)
		expect(automaticCheckIsDue(start + 4 * 3600000)).toBe(true)
		rememberFailedChecks(1000)
		expect(automaticCheckIsDue(start + 24 * 3600000 - 1)).toBe(false)
		expect(automaticCheckIsDue(start + 24 * 3600000)).toBe(true)
	})
	it('keeps KesVio storage keys and dismissed-version values', () => {
		rememberAutomaticChecks(false)
		rememberDismissedVersion('0.5.1')
		expect(localStorage.getItem('kesvio.automatic-update-checks')).toBe(
			'off',
		)
		expect(storedAutomaticChecks()).toBe(false)
		expect(dismissedVersion()).toBe('0.5.1')
	})
	it('falls back safely when storage cannot be read or written', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied')
		})
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('full')
		})
		expect(storedAutomaticChecks()).toBe(true)
		expect(dismissedVersion()).toBeNull()
		expect(failedChecks()).toBe(0)
		expect(automaticCheckIsDue(Date.now())).toBe(true)
		expect(() => {
			rememberCheck(1)
			rememberFailedChecks(1)
			rememberAutomaticChecks(false)
			rememberDismissedVersion('0.5.1')
		}).not.toThrow()
	})
})
