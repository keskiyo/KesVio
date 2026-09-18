import { describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { resolveSearchAliases } from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import { ALIAS_NEGATIVE_QUERIES } from './fixtures/aliasNegativeQueries'
import { CATALOGS } from './fixtures/catalogs'

// Each row names a record that must not own the alias behind the query (a host, a helper, an
// installer, a sibling product) and, unless the row is alias-only because the record's own
// literal name legitimately answers the query, must not come first for it either.
describe('alias negative queries', () => {
	it('names records that exist in their catalogs', () => {
		expect(ALIAS_NEGATIVE_QUERIES.length).toBeGreaterThanOrEqual(60)
		for (const row of ALIAS_NEGATIVE_QUERIES)
			expect(
				CATALOGS[row.catalog].some(
					entry => entry.id === row.mustNotOwnAlias,
				),
				`${row.catalog}: ${row.mustNotOwnAlias}`,
			).toBe(true)
	})

	it.each(
		ALIAS_NEGATIVE_QUERIES.map(row => [
			`${row.catalog} › ${row.query} ⇏ ${row.mustNotOwnAlias}`,
			row,
		]),
	)('%s', (_label, row) => {
		const record = CATALOGS[row.catalog].find(
			entry => entry.id === row.mustNotOwnAlias,
		)!
		const aliases = resolveSearchAliases(record).map(alias => alias.value)
		expect(aliases, `${record.name} owns ${row.query}`).not.toContain(
			row.query.toLocaleLowerCase(),
		)
		if (!row.mustNotRankFirst) return
		const ranked = rankAppsByQuery(CATALOGS[row.catalog], row.query)
		expect(
			ranked[0]?.id,
			`${record.name} ranks first for ${row.query}: ${ranked
				.slice(0, 3)
				.map(entry => entry.id)
				.join(', ')}`,
		).not.toBe(row.mustNotOwnAlias)
	})
})
