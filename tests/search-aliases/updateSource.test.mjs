import { describe, expect, it } from 'vitest'
import { archiveUrl } from '../../scripts/search-aliases/update-source.mjs'

describe('update-source archive pinning', () => {
	it('builds the archive url only for a full commit sha inside the expected repository', () => {
		expect(archiveUrl('0a5a7ba57e69adc0a8016154b5b1d7eaae82f916')).toBe(
			'https://codeload.github.com/microsoft/winget-pkgs/tar.gz/0a5a7ba57e69adc0a8016154b5b1d7eaae82f916',
		)
		expect(() => archiveUrl('master')).toThrow(/non-commit/)
		expect(() => archiveUrl('../../evil')).toThrow()
	})
})
