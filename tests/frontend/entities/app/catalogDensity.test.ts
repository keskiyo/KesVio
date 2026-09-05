import { describe, expect, it } from 'vitest'
import {
	CATALOG_DENSITIES,
	DEFAULT_CATALOG_DENSITY,
} from '../../../../src/entities/app'

describe('catalog density contract', () => {
	it('uses compact when a new catalog has no saved preference', () => {
		expect(CATALOG_DENSITIES).toEqual(['comfortable', 'compact', 'dense'])
		expect(DEFAULT_CATALOG_DENSITY).toBe('compact')
		expect(CATALOG_DENSITIES).toContain(DEFAULT_CATALOG_DENSITY)
	})
})
