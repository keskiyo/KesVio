import { readStylesheet } from './readStylesheet.mjs'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()
const reducedMotion = stylesheet.match(
	/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/,
)

describe('reduced motion', () => {
	it('removes decorative animation without globally rewriting durations', () => {
		expect(reducedMotion?.[1]).not.toMatch(/\*,\s*\*::before/)
		expect(reducedMotion?.[1]).toContain('.activity-bar-fill')
		expect(reducedMotion?.[1]).toContain('animation: none')
	})
})
