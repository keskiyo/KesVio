import { describe, expect, it } from 'vitest'
import type { AppInfo } from '../../../../src/entities/app'
import {
	type Scenario,
	rankScenariosByQuery,
} from '../../../../src/entities/scenario'

function app(value: Partial<AppInfo> & Pick<AppInfo, 'id'>): AppInfo {
	return {
		name: value.id,
		path: `C:\\Apps\\${value.id}.exe`,
		category: 'other',
		iconBase64: null,
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		...value,
	}
}

function scenario(value: Partial<Scenario> & Pick<Scenario, 'id'>): Scenario {
	return {
		name: value.id,
		launchIdentities: [],
		closeIdentities: [],
		createdAt: null,
		...value,
	}
}

const catalog = [
	app({ id: 'steam', name: 'Steam' }),
	app({ id: 'code', name: 'Visual Studio Code' }),
]

const gaming = scenario({
	id: 'gaming',
	name: 'Gaming',
	launchIdentities: ['steam'],
})
const work = scenario({
	id: 'work',
	name: 'Work',
	launchIdentities: ['code'],
})

function ids(scenarios: Scenario[]): string[] {
	return scenarios.map(entry => entry.id)
}

describe('rankScenariosByQuery', () => {
	it('returns everything for an empty query', () => {
		expect(
			ids(rankScenariosByQuery([gaming, work], catalog, '  ')),
		).toEqual(['gaming', 'work'])
	})

	it('matches a scenario by its own name', () => {
		expect(
			ids(rankScenariosByQuery([gaming, work], catalog, 'work')),
		).toEqual(['work'])
	})

	// The apps are the reason a scenario exists, so remembering one of them is enough to find it.
	it('matches a scenario by an app it launches', () => {
		expect(
			ids(rankScenariosByQuery([gaming, work], catalog, 'steam')),
		).toEqual(['gaming'])
	})

	// An entry the catalog no longer resolves still has its stored name, and the scenario that
	// needs fixing is exactly the one worth finding.
	it('matches an app the catalog no longer has by its stored name', () => {
		const stale = scenario({
			id: 'stale',
			name: 'Stale',
			launchIdentities: ['gone'],
			launchAppSnapshots: {
				gone: { name: 'Photoshop', iconBase64: null },
			},
		})

		expect(
			ids(rankScenariosByQuery([stale, work], catalog, 'photoshop')),
		).toEqual(['stale'])
	})

	it('ranks a name match above a scenario that merely launches something similar', () => {
		const launcher = scenario({
			id: 'launcher',
			name: 'Evening',
			launchIdentities: ['steam'],
		})
		const named = scenario({ id: 'named', name: 'Steam night' })

		expect(
			ids(rankScenariosByQuery([launcher, named], catalog, 'steam')),
		).toEqual(['named', 'launcher'])
	})

	// Typing before switching layouts is the common case, not an edge case.
	it('finds a scenario typed in the wrong keyboard layout', () => {
		expect(
			ids(rankScenariosByQuery([gaming, work], catalog, 'цщкл')),
		).toEqual(['work'])
	})

	it('tolerates a single typo in a long enough word', () => {
		expect(
			ids(rankScenariosByQuery([gaming, work], catalog, 'gamnig')),
		).toEqual(['gaming'])
	})

	it('requires every word of the query to match', () => {
		expect(
			rankScenariosByQuery([gaming, work], catalog, 'gaming missing'),
		).toEqual([])
	})
})
