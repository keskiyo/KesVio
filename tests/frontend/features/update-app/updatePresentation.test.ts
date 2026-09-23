import { describe, expect, it } from 'vitest'
import {
	isUpdateInstalling,
	updateErrorMessage,
	updatePresentation,
	updateProgressLabel,
} from '../../../../src/features/update-app/lib/updatePresentation'

describe('update presentation', () => {
	it('exposes only the version of an available update', () => {
		const handle = {
			version: '0.5.1',
			rawJson: { releaseUrl: 'javascript:alert(1)' },
			download: async () => {},
			install: async () => {},
			close: async () => {},
		}
		expect(updatePresentation(handle)).toEqual({ version: '0.5.1' })
		expect(updatePresentation(null)).toBeNull()
	})
	it('returns safe text for unknown errors containing local paths', () => {
		expect(updateErrorMessage(new Error('C:\\Users\\Private\\file'))).toBe(
			'The update could not be installed. Try again or download it manually.',
		)
	})
	it('allows retry after failure and keeps restart in the installing state', () => {
		expect(isUpdateInstalling('failed')).toBe(false)
		expect(isUpdateInstalling('restarting')).toBe(true)
	})
	it('names every installing stage, with a percentage only while it is known', () => {
		expect(updateProgressLabel('downloading', 42)).toBe('Downloading 42%')
		expect(updateProgressLabel('downloading', null)).toBe('Downloading…')
		expect(updateProgressLabel('verifying', 100)).toBe('Verifying…')
		expect(updateProgressLabel('installing', 100)).toBe('Installing…')
		expect(updateProgressLabel('restarting', 100)).toBe('Restarting…')
	})
})
