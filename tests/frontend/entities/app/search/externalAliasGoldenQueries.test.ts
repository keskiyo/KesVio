import { beforeAll, describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { KNOWN_APP_ALIASES } from '../../../../../src/entities/app/lib/search/knownAppAliases'
import {
	knownPackageEntries,
	loadKnownPackageIndex,
} from '../../../../../src/entities/app/lib/search/knownPackageIndex'
import { EXTERNAL_ONLY } from './fixtures/catalogs/externalOnly'
import { EXTERNAL_ALIAS_GOLDEN_QUERIES } from './fixtures/externalAliasGoldenQueries'

describe('external alias golden queries', () => {
	beforeAll(async () => {
		await loadKnownPackageIndex()
	})

	it('runs against the shipped known-package index, not an empty fallback', () => {
		expect(knownPackageEntries().length).toBeGreaterThan(5000)
		expect(EXTERNAL_ALIAS_GOLDEN_QUERIES.length).toBeGreaterThanOrEqual(100)
		expect(EXTERNAL_ONLY.length).toBeGreaterThanOrEqual(80)
		for (const row of EXTERNAL_ALIAS_GOLDEN_QUERIES)
			expect(
				EXTERNAL_ONLY.some(entry => entry.id === row.expectedTop),
				row.expectedTop,
			).toBe(true)
	})

	it('names at least 80 aliases the curated dictionary does not carry', () => {
		const curated = new Set(
			KNOWN_APP_ALIASES.flatMap(entry =>
				entry.aliases.map(([value]) => value),
			),
		)
		const externalOnly = EXTERNAL_ALIAS_GOLDEN_QUERIES.filter(
			row => !row.curated && !curated.has(row.query),
		)
		expect(externalOnly.length).toBeGreaterThanOrEqual(80)
	})

	it.each(
		EXTERNAL_ALIAS_GOLDEN_QUERIES.map(row => [
			`${row.query} → ${row.expectedTop}`,
			row,
		]),
	)('%s', (_label, row) => {
		const ranked = rankAppsByQuery(EXTERNAL_ONLY, row.query).map(
			entry => entry.id,
		)
		const within = row.within ?? 1
		expect(
			ranked.slice(0, within),
			`got ${ranked.slice(0, 5).join(', ') || 'nothing'}`,
		).toContain(row.expectedTop)
	})

	it('reports top-1 accuracy of the external corpus', () => {
		let firsts = 0
		for (const row of EXTERNAL_ALIAS_GOLDEN_QUERIES)
			if (
				rankAppsByQuery(EXTERNAL_ONLY, row.query)[0]?.id ===
				row.expectedTop
			)
				firsts += 1
		expect(
			firsts / EXTERNAL_ALIAS_GOLDEN_QUERIES.length,
		).toBeGreaterThanOrEqual(0.97)
	})
})
