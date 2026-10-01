import { type AppInfo, appIdentity } from '../../entities/app'
import type { AppCategory } from '../../entities/category'

function groupByCanonicalIdentity(apps: AppInfo[]): Map<string, AppInfo[]> {
	const groups = new Map<string, AppInfo[]>()
	for (const app of apps) {
		if (!app.canonicalIdentity) continue
		const group = groups.get(app.canonicalIdentity) ?? []
		group.push(app)
		groups.set(app.canonicalIdentity, group)
	}
	return groups
}

export function reconcileSelection(
	apps: AppInfo[],
	ids: string[],
	identities: string[],
	legacyCanonicalIdentities: string[],
): { ids: string[]; identities: string[]; unresolvedLegacy: string[] } {
	const byId = new Map(apps.map(app => [app.id, app]))
	const mergedIdentities = new Set(identities)
	const unresolvedLegacy = new Set(legacyCanonicalIdentities)
	for (const legacyId of ids) {
		const app = byId.get(legacyId)
		if (!app) continue
		mergedIdentities.add(appIdentity(app))
		if (app.canonicalIdentity)
			unresolvedLegacy.delete(app.canonicalIdentity)
	}
	const byCanonicalIdentity = groupByCanonicalIdentity(apps)
	for (const legacyIdentity of unresolvedLegacy) {
		const matches = byCanonicalIdentity.get(legacyIdentity)
		if (matches?.length !== 1) continue
		mergedIdentities.add(appIdentity(matches[0]))
		unresolvedLegacy.delete(legacyIdentity)
	}
	const currentIds = apps
		.filter(app => mergedIdentities.has(appIdentity(app)))
		.map(app => app.id)
	return {
		ids: currentIds,
		identities: [...mergedIdentities],
		unresolvedLegacy: [...unresolvedLegacy],
	}
}

export function reconcileOverrides(
	apps: AppInfo[],
	idOverrides: Record<string, AppCategory>,
	identityOverrides: Record<string, AppCategory>,
	legacyCanonicalOverrides: Record<string, AppCategory>,
): {
	overrides: Record<string, AppCategory>
	overrideIdentities: Record<string, AppCategory>
	unresolvedLegacy: Record<string, AppCategory>
} {
	const byId = new Map(apps.map(app => [app.id, app]))
	const mergedIdentities: Record<string, AppCategory> = {
		...identityOverrides,
	}
	const unresolvedLegacy = { ...legacyCanonicalOverrides }
	for (const [legacyId, category] of Object.entries(idOverrides)) {
		const app = byId.get(legacyId)
		if (app && !(appIdentity(app) in mergedIdentities))
			mergedIdentities[appIdentity(app)] = category
		if (app?.canonicalIdentity)
			delete unresolvedLegacy[app.canonicalIdentity]
	}
	const byCanonicalIdentity = groupByCanonicalIdentity(apps)
	for (const [legacyIdentity, category] of Object.entries(unresolvedLegacy)) {
		const matches = byCanonicalIdentity.get(legacyIdentity)
		if (matches?.length !== 1) continue
		if (!(appIdentity(matches[0]) in mergedIdentities))
			mergedIdentities[appIdentity(matches[0])] = category
		delete unresolvedLegacy[legacyIdentity]
	}
	const overrides: Record<string, AppCategory> = {}
	for (const app of apps) {
		const category = mergedIdentities[appIdentity(app)]
		if (category) overrides[app.id] = category
	}
	return {
		overrides,
		overrideIdentities: mergedIdentities,
		unresolvedLegacy,
	}
}
