import { describe, expect, it } from 'vitest'
import { countLabel } from '../../../src/shared/lib/countLabel'

describe('countLabel', () => {
	it('leaves a single item singular', () => {
		expect(countLabel(1, 'app')).toBe('1 app')
		expect(countLabel(1, 'match')).toBe('1 match')
	})

	it('pluralizes every other count, zero included', () => {
		expect(countLabel(0, 'app')).toBe('0 apps')
		expect(countLabel(2, 'tool')).toBe('2 tools')
		expect(countLabel(175, 'scenario')).toBe('175 scenarios')
	})

	// A plain `${noun}s` produced "matchs" in the search summary, which is the reason this helper
	// exists rather than the expression it replaced at four call sites.
	it('adds -es after a sibilant ending', () => {
		expect(countLabel(3, 'match')).toBe('3 matches')
		expect(countLabel(2, 'box')).toBe('2 boxes')
		expect(countLabel(2, 'dish')).toBe('2 dishes')
		expect(countLabel(2, 'lens')).toBe('2 lenses')
	})
})
