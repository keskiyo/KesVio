import { describe, expect, it } from 'vitest'
import { parentFolderName } from '../../../src/shared/lib/paths'

describe('parentFolderName', () => {
	it('names the folder that holds a file on either separator', () => {
		expect(parentFolderName('E:\\Shared\\Downloads\\setup.exe')).toBe(
			'Downloads',
		)
		expect(parentFolderName('/home/user/docs/readme.pdf')).toBe('docs')
		expect(parentFolderName('C:\\setup.exe')).toBe('C:')
	})

	it('has no folder for a bare file name or an empty path', () => {
		expect(parentFolderName('setup.exe')).toBeNull()
		expect(parentFolderName('   ')).toBeNull()
	})
})
