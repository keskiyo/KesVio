import { type AppInfo, appIdentity } from '../../app'
import type { Scenario, ScenarioAppSnapshot } from '../model/scenario.types'
import {
	buildScenarioLookup,
	findScenarioApp,
	type ScenarioCatalogLookup,
} from './scenarioCatalogLookup'
import { scenarioAppSnapshot } from './scenarioSnapshots'

interface ReconciledList {
	identities: string[]
	snapshots: Record<string, ScenarioAppSnapshot>
	changed: boolean
}

function replacementFor(
	identity: string,
	snapshot: ScenarioAppSnapshot | undefined,
	lookup: ScenarioCatalogLookup,
): AppInfo | null {
	if (lookup.byIdentity.has(identity)) return null
	const app = findScenarioApp(lookup, identity, snapshot)
	return app && appIdentity(app) !== identity ? app : null
}

function reconcileList(
	identities: string[],
	snapshots: Record<string, ScenarioAppSnapshot>,
	reserved: string[],
	lookup: ScenarioCatalogLookup,
): ReconciledList {
	const nextIdentities: string[] = []
	const nextSnapshots = { ...snapshots }
	const taken = new Set(reserved)
	let changed = false
	for (const identity of identities) {
		const replacement = replacementFor(
			identity,
			snapshots[identity],
			lookup,
		)
		if (!replacement) {
			nextIdentities.push(identity)
			continue
		}
		changed = true
		delete nextSnapshots[identity]
		const rekeyed = appIdentity(replacement)
		if (taken.has(rekeyed) || nextIdentities.includes(rekeyed)) continue
		nextIdentities.push(rekeyed)
		nextSnapshots[rekeyed] = scenarioAppSnapshot(replacement)
	}
	return { identities: nextIdentities, snapshots: nextSnapshots, changed }
}

export function reconcileScenarios(
	scenarios: Scenario[],
	apps: AppInfo[],
): Scenario[] | null {
	if (apps.length === 0) return null
	const lookup = buildScenarioLookup(apps)
	let changed = false
	const next = scenarios.map(scenario => {
		const launch = reconcileList(
			scenario.launchIdentities,
			scenario.launchAppSnapshots ?? {},
			scenario.closeIdentities,
			lookup,
		)
		const close = reconcileList(
			scenario.closeIdentities,
			scenario.closeAppSnapshots ?? {},
			scenario.launchIdentities,
			lookup,
		)
		if (!launch.changed && !close.changed) return scenario
		changed = true
		return {
			...scenario,
			launchIdentities: launch.identities,
			launchAppSnapshots: launch.snapshots,
			closeIdentities: close.identities,
			closeAppSnapshots: close.snapshots,
		}
	})
	return changed ? next : null
}
