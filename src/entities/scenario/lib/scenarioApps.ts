import type { AppInfo } from '../../app'
import type { ScenarioAppSnapshot } from '../model/scenario.types'
import { buildScenarioLookup, findScenarioApp } from './scenarioCatalogLookup'

export interface UnavailableScenarioApp {
	identity: string
	name: string
	iconBase64: string | null
}

export interface ResolvedScenarioList {
	apps: AppInfo[]
	unavailable: UnavailableScenarioApp[]
	missing: number
}

export function resolveScenarioApps(
	identities: string[],
	apps: AppInfo[],
	snapshots: Record<string, ScenarioAppSnapshot> = {},
): ResolvedScenarioList {
	const lookup = buildScenarioLookup(apps)
	const resolved: AppInfo[] = []
	const unavailable: UnavailableScenarioApp[] = []
	for (const identity of identities) {
		const snapshot = snapshots[identity]
		const app = findScenarioApp(lookup, identity, snapshot)
		if (app) resolved.push(app)
		else {
			unavailable.push({
				identity,
				name: snapshot?.name ?? 'Unavailable application',
				iconBase64: snapshot?.iconBase64 ?? null,
			})
		}
	}
	return { apps: resolved, unavailable, missing: unavailable.length }
}
