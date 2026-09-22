import { beforeAll, describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { loadKnownPackageIndex } from '../../../../../src/entities/app/lib/search/knownPackageIndex'
import { resolveSearchAliases } from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import { REAL_WORLD_GAPS } from './fixtures/realWorldGaps'

// The regression corpus of the search-gap workflow (docs/search-aliases.md, "Search gap triage").
// Every row started as a reproduced real query; a row with expectedTop null pins a false
// positive that must stay fixed.
describe('real-world search gaps', () => {
	beforeAll(async () => {
		await loadKnownPackageIndex()
	})

	it.each(
		REAL_WORLD_GAPS.map(gap => [
			`${gap.query} → ${gap.expectedTop ?? 'nothing'} (${gap.classification})`,
			gap,
		]),
	)('%s', (_label, gap) => {
		const ranked = rankAppsByQuery(gap.catalog, gap.query).map(
			entry => entry.id,
		)
		if (gap.expectedTop === null) expect(ranked).toEqual([])
		else
			expect(ranked[0], `got ${ranked.join(', ') || 'nothing'}`).toBe(
				gap.expectedTop,
			)
		for (const record of gap.catalog)
			for (const value of gap.mustNotOwn ?? [])
				expect(
					resolveSearchAliases(record).map(alias => alias.value),
					` owns ${value}`,
				).not.toContain(value)
	})

	it('never grants a strong alias to a record outside the curated dictionary', () => {
		for (const gap of REAL_WORLD_GAPS)
			for (const record of gap.catalog)
				for (const alias of resolveSearchAliases(record))
					if (alias.confidence === 'strong')
						expect(
							gap.classification,
							`${record.name} ${alias.value}`,
						).not.toBe('FALSE_POSITIVE_IDENTITY')
	})
})
