import type { AppInfo } from '../../app'
import type { Scenario, ScenarioAppSnapshot } from '../model/scenario.types'
import { buildScenarioLookup, findScenarioApp } from './scenarioCatalogLookup'
import type { ScenarioCatalogLookup } from './scenarioCatalogLookup'

const MIN_FUZZY_LENGTH = 4

export interface ScenarioSearchFields {
	name: string
	apps: string
	words: string[]
}

interface CachedFields {
	catalog: AppInfo[]
	fields: ScenarioSearchFields
}

const cache = new WeakMap<Scenario, CachedFields>()

function scenarioLists(
	scenario: Scenario,
): [string[], Record<string, ScenarioAppSnapshot>][] {
	return [
		[scenario.launchIdentities, scenario.launchAppSnapshots ?? {}],
		[scenario.closeIdentities, scenario.closeAppSnapshots ?? {}],
	]
}

function appNames(scenario: Scenario, lookup: ScenarioCatalogLookup): string[] {
	const names: string[] = []
	for (const [identities, snapshots] of scenarioLists(scenario)) {
		for (const identity of identities) {
			const snapshot = snapshots[identity]
			const app = findScenarioApp(lookup, identity, snapshot)
			const name = app?.name ?? snapshot?.name
			if (name) names.push(name)
		}
	}
	return names
}

function buildFields(
	scenario: Scenario,
	lookup: ScenarioCatalogLookup,
): ScenarioSearchFields {
	const name = scenario.name.toLocaleLowerCase()
	const apps = appNames(scenario, lookup).join(' ').toLocaleLowerCase()
	return {
		name,
		apps,
		words: `${name} ${apps}`
			.split(/[^\p{L}\p{N}]+/u)
			.filter(word => word.length >= MIN_FUZZY_LENGTH),
	}
}

export function scenarioFieldsReader(
	apps: AppInfo[],
): (scenario: Scenario) => ScenarioSearchFields {
	const lookup = buildScenarioLookup(apps)
	return scenario => {
		const cached = cache.get(scenario)
		if (cached && cached.catalog === apps) return cached.fields
		const fields = buildFields(scenario, lookup)
		cache.set(scenario, { catalog: apps, fields })
		return fields
	}
}
