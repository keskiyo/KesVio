import { type AppInfo, appIdentity } from '../../app'
import type { ScenarioAppSnapshot } from '../model/scenario.types'

export interface ScenarioCatalogLookup {
	byIdentity: Map<string, AppInfo>
	byUniqueName: Map<string, AppInfo | null>
}

export function buildScenarioLookup(apps: AppInfo[]): ScenarioCatalogLookup {
	const byIdentity = new Map<string, AppInfo>()
	for (const app of apps) byIdentity.set(appIdentity(app), app)
	for (const app of apps) {
		for (const alias of [app.canonicalIdentity, app.id]) {
			if (alias && !byIdentity.has(alias)) byIdentity.set(alias, app)
		}
	}
	const byUniqueName = new Map<string, AppInfo | null>()
	for (const app of apps) {
		const name = app.name.trim().toLowerCase()
		if (!name) continue
		byUniqueName.set(name, byUniqueName.has(name) ? null : app)
	}
	return { byIdentity, byUniqueName }
}

export function findScenarioApp(
	lookup: ScenarioCatalogLookup,
	identity: string,
	snapshot: ScenarioAppSnapshot | undefined,
): AppInfo | null {
	const durable = lookup.byIdentity.get(identity)
	if (durable) return durable
	const name = snapshot?.name.trim().toLowerCase()
	return (name ? lookup.byUniqueName.get(name) : null) ?? null
}
