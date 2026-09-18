import { describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { ALIAS_GOLDEN_QUERIES } from './fixtures/aliasGoldenQueries'
import { CATALOGS } from './fixtures/catalogs'

// The corpus is the product contract for aliases: a strong alias puts its app first, a weaker
// one keeps it inside the top three. Every alias of three characters or fewer has a row here
// (dictionaryGovernance.test.ts enforces that), so a short alias cannot be added untested.
describe('alias golden queries', () => {
	it('covers every catalog and holds at least 200 queries', () => {
		expect(ALIAS_GOLDEN_QUERIES.length).toBeGreaterThanOrEqual(200)
		const catalogs = new Set<string>(
			ALIAS_GOLDEN_QUERIES.map(row => row.catalog),
		)
		for (const name of Object.keys(CATALOGS))
			expect(catalogs.has(name)).toBe(true)
		for (const row of ALIAS_GOLDEN_QUERIES)
			expect(
				CATALOGS[row.catalog].some(
					entry => entry.id === row.expectedTop,
				),
				`${row.catalog}: ${row.expectedTop}`,
			).toBe(true)
	})

	it.each(
		ALIAS_GOLDEN_QUERIES.map(row => [`${row.catalog} › ${row.query}`, row]),
	)('%s', (_label, row) => {
		const ranked = rankAppsByQuery(CATALOGS[row.catalog], row.query).map(
			entry => entry.id,
		)
		const within = row.within ?? 1
		expect(
			ranked.slice(0, within),
			`expected ${row.expectedTop} within top ${within}, got ${ranked.slice(0, 5).join(', ')}`,
		).toContain(row.expectedTop)
	})

	it('reports top-1 accuracy of the whole corpus', () => {
		let firsts = 0
		for (const row of ALIAS_GOLDEN_QUERIES) {
			const ranked = rankAppsByQuery(CATALOGS[row.catalog], row.query)
			if (ranked[0]?.id === row.expectedTop) firsts += 1
		}
		expect(firsts / ALIAS_GOLDEN_QUERIES.length).toBeGreaterThanOrEqual(
			0.98,
		)
	})
})
