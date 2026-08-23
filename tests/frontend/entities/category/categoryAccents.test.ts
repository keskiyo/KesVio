import { describe, expect, it } from 'vitest'
import {
	chooseCustomCategoryAccent,
	CUSTOM_CATEGORY_ACCENTS,
	stableCustomCategoryAccent,
} from '../../../../src/entities/category/lib/categoryAccents'

describe('category accents', () => {
	it('uses an available accent before repeating one', () => {
		expect(chooseCustomCategoryAccent(['yellow', 'cyan'], () => 0)).toBe(
			'pink',
		)
	})

	it('derives the same accent for a migrated category id', () => {
		expect(stableCustomCategoryAccent('custom:work')).toBe(
			stableCustomCategoryAccent('custom:work'),
		)
	})

	it('names every accent once', () => {
		expect(new Set(CUSTOM_CATEGORY_ACCENTS).size).toBe(
			CUSTOM_CATEGORY_ACCENTS.length,
		)
	})

	// Eight accents over a catalog this size put the same colour on unrelated rows often enough to
	// read as a pattern. The derived accent is a hash modulo the palette, so widening the palette is
	// what spreads existing categories apart.
	it('spreads derived accents across most of the palette', () => {
		const derived = new Set(
			Array.from({ length: 60 }, (_, index) =>
				stableCustomCategoryAccent(`custom:category-${index}`),
			),
		)

		expect(derived.size).toBeGreaterThanOrEqual(10)
	})
})
