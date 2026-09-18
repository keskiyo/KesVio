import { describe, expect, it } from 'vitest'
import { middleEllipsis } from '../../../src/shared/lib/text'

describe('middleEllipsis', () => {
	it('keeps short values and middle-truncates long ones', () => {
		expect(middleEllipsis('editor.exe', 20)).toBe('editor.exe')
		expect(middleEllipsis('1234567890', 7)).toBe('123…890')
		expect(middleEllipsis('abc', 1)).toBe('…')
	})
})
