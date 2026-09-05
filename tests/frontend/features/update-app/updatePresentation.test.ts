import { describe, expect, it } from 'vitest'
import {
	isUpdateInstalling,
	updateErrorMessage,
	updatePresentation,
} from '../../../../src/features/update-app/lib/updatePresentation'

describe('update presentation', () => {
	it('drops unsafe links and invalid package sizes from metadata', () => {
		const handle = {
			version: '0.5.1',
			rawJson: {
				releaseUrl: 'javascript:alert(1)',
				packageSize: Infinity,
			},
			download: async () => {},
			install: async () => {},
			close: async () => {},
		}
		expect(updatePresentation(handle)).toEqual({
			version: '0.5.1',
			notes: null,
			date: null,
			packageSize: null,
			releaseUrl: null,
		})
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
})
