import { bench, describe } from 'vitest'
import { rankAppsByQuery } from '../../src/entities/app/lib/catalogSearch'
import { KNOWN_PACKAGE_INDEX } from '../../src/entities/app/lib/search/generated/knownPackages'
import { candidateKnownEntries } from '../../src/entities/app/lib/search/knownAliasIndex'
import { appMatchFacts } from '../../src/entities/app/lib/search/knownAliasMatch'
import {
	decodeKnownPackageIndex,
	installKnownPackageEntries,
} from '../../src/entities/app/lib/search/knownPackageIndex'
import { resolveSearchAliases } from '../../src/entities/app/lib/search/resolveSearchAliases'
import { fieldsFor } from '../../src/entities/app/lib/search/searchFields'
import { EXTERNAL_ONLY } from '../frontend/entities/app/search/fixtures/catalogs/externalOnly'
import { syntheticCatalog } from './syntheticCatalog'

// The external known-package index is a lazy chunk decoded once per session. "cold" benches
// measure that one-time cost (decode, then the first candidate lookup that builds the reverse
// index); the ranking benches measure a keystroke over 2000 synthetic records plus the
// external-only fixture catalog with the index installed.
const entries = decodeKnownPackageIndex(KNOWN_PACKAGE_INDEX)
const apps = [...syntheticCatalog(2000), ...EXTERNAL_ONLY]
const probe = appMatchFacts(apps[0]!)
const queries: Record<string, string> = {
	'external alias exact': 'kubectl',
	'external command': 'gsutil',
	'external moniker': 'nvim',
	'external russian layout': 'зкщещтмзт',
	'external collision': 'copilot',
	'external multi-word': 'chrome beta',
	'curated strong alias': 'vscode',
	'no match': 'xqzv',
}

describe('external alias index', () => {
	bench('decodeKnownPackageIndex - cold', () => {
		decodeKnownPackageIndex(KNOWN_PACKAGE_INDEX)
	})
	bench('install + first candidate lookup - cold', () => {
		installKnownPackageEntries(entries)
		candidateKnownEntries(probe)
	})
})

describe('search ranking on 2000 records + external catalog', () => {
	installKnownPackageEntries(entries)
	for (const app of apps) fieldsFor(app)
	for (const [label, query] of Object.entries(queries)) {
		bench(`rankAppsByQuery - ${label}`, () => {
			rankAppsByQuery(apps, query)
		})
	}
	bench('resolveSearchAliases - 2000 apps cold with external index', () => {
		for (const app of apps) resolveSearchAliases(app)
	})
	bench('fieldsFor - 2000 apps warm with external index', () => {
		for (const app of apps) fieldsFor(app)
	})
})
