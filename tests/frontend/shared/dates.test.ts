import { describe, expect, it } from 'vitest'
import { formatBytes } from '../../../src/shared/lib/bytes'
import { formatDate, formatDateTime } from '../../../src/shared/lib/dates'

describe('shared formatters', () => {
	it('formats dates in one English style and refuses invalid ones', () => {
		expect(formatDate(new Date(0))).toBe('Jan 1, 1970')
		expect(formatDate(new Date('nope'))).toBeNull()
		expect(formatDateTime(new Date('nope'))).toBeNull()
		expect(formatDateTime(new Date(0))).toContain('1970')
	})

	it('scales bytes through one unit ladder', () => {
		expect(formatBytes(0)).toBe('0 B')
		expect(formatBytes(1_572_864)).toBe('1.5 MB')
		expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
		expect(formatBytes(3 * 1024 ** 3)).toBe('3 GB')
	})
})
