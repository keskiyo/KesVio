import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CUSTOM_CATEGORY_ACCENTS } from '../../../src/entities/category/lib/categoryAccents'

const stylesheet = readFileSync('src/app/styles/index.css', 'utf8')

const ALL_ACCENTS = [...CUSTOM_CATEGORY_ACCENTS, 'slate', 'neutral']

// An accent without a token or without a row selector renders no colour at all: the row silently
// falls back to the neutral border and the category looks unstyled rather than broken.
describe('category accent tokens', () => {
	it.each(ALL_ACCENTS)('declares a --category-%s token', accent => {
		expect(stylesheet).toContain(`--category-${accent}:`)
	})

	it.each(ALL_ACCENTS)('maps %s onto a navigation row', accent => {
		expect(stylesheet).toContain(
			`.navigation-category-row[data-category-accent='${accent}'] {`,
		)
	})

	it('gives every hue accent a distinct value', () => {
		const values = CUSTOM_CATEGORY_ACCENTS.map(
			accent =>
				stylesheet.match(
					new RegExp(`--category-${accent}:\\s*([^;]+);`),
				)?.[1],
		)

		expect(values.every(Boolean)).toBe(true)
		expect(new Set(values).size).toBe(values.length)
	})
})
