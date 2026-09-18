import { bench, describe } from 'vitest'
import {
	filterAppsByQuery,
	rankAppsByQuery,
	rankAppsByQueryTop,
} from '../../src/entities/app/lib/catalogSearch'
import { resolveSearchAliases } from '../../src/entities/app/lib/search/resolveSearchAliases'
import { fieldsFor } from '../../src/entities/app/lib/search/searchFields'
import { syntheticCatalog } from './syntheticCatalog'

// The search budget in INFO.md §8.4 is "p95 ≤ 100 ms from keystroke to updated grid on 2000
// records". This bench measures the pure ranking that runs on every deferred keystroke; React
// rendering and the WebView2 clock are measured natively. Numbers here are a regression tripwire
// for the ranking itself, recorded by scripts/measure-performance.ps1, never asserted in tests.
const apps = syntheticCatalog(2000)
const queries: Record<string, string> = {
	'common prefix': 'co',
	'exact name': 'steam 123',
	'exact product': 'visual studio code',
	'fuzzy typo': 'phtoshop',
	'russian layout': 'cntfv',
	'strong alias': 'vscode',
	'normal alias': 'code',
	'alias russian layout': 'мысщву',
	'multi-word alias': 'vs code',
	'short alias': 'cmd',
	'no match': 'xqzv',
}

describe('search ranking on 2000 records', () => {
	for (const [label, query] of Object.entries(queries)) {
		bench(`rankAppsByQuery - ${label}`, () => {
			rankAppsByQuery(apps, query)
		})
	}
	bench('rankAppsByQueryTop 8 - common prefix', () => {
		rankAppsByQueryTop(apps, 'co', 8)
	})
	bench('filterAppsByQuery - two tokens', () => {
		filterAppsByQuery(apps, 'micro code')
	})
	bench('resolveSearchAliases - 2000 apps cold', () => {
		for (const app of apps) resolveSearchAliases(app)
	})
	bench('fieldsFor - 2000 apps warm', () => {
		for (const app of apps) fieldsFor(app)
	})
})
