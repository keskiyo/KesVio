import { appIdentity } from '../lib/appIdentity'
import { isCatalogView } from '../lib/appView'
import {
	INSTALLERS_DOCS_CATEGORY,
	isCatalogArtifact,
} from '../lib/catalogArtifacts'
import type { AppInfo, AppView } from './app.types'

export type AppPredicate = (app: AppInfo) => boolean

export function createMarkLookup(
	ids: string[],
	identities: string[],
): AppPredicate {
	const byId = new Set(ids)
	const byIdentity = new Set(identities)
	return app => byId.has(app.id) || byIdentity.has(appIdentity(app))
}

export function filterVisibleApps(
	categorized: AppInfo[],
	activeView: AppView,
	isHidden: AppPredicate,
	isFavorite: AppPredicate,
): AppInfo[] {
	if (!isCatalogView(activeView)) return []
	if (activeView === 'installers_docs')
		return categorized.filter(
			app => isCatalogArtifact(app) && !isHidden(app),
		)
	if (activeView === 'auxiliary')
		return categorized.filter(
			app =>
				!isCatalogArtifact(app) &&
				app.visibilityClass === 'auxiliary' &&
				!isHidden(app),
		)
	if (activeView === 'hidden') return categorized.filter(isHidden)
	const visible = categorized.filter(
		app =>
			!isCatalogArtifact(app) &&
			app.visibilityClass !== 'auxiliary' &&
			!isHidden(app),
	)
	return activeView === 'favorites' ? visible.filter(isFavorite) : visible
}

export interface SearchScopeCounts {
	all: number
	auxiliary: number
	hidden: number
	installersDocs: number
}

export function selectSearchScopeCounts(
	matches: AppInfo[],
	isHidden: AppPredicate,
): SearchScopeCounts {
	const counts = { all: 0, auxiliary: 0, hidden: 0, installersDocs: 0 }
	for (const app of matches) {
		if (isHidden(app)) counts.hidden += 1
		else if (isCatalogArtifact(app)) counts.installersDocs += 1
		else if (app.visibilityClass === 'auxiliary') counts.auxiliary += 1
		else counts.all += 1
	}
	return counts
}

export function selectRecentApps(
	apps: AppInfo[],
	rankOf: (app: AppInfo) => number,
	limit: number,
): AppInfo[] {
	if (apps.length <= 1) return apps.slice(0, limit)
	return [...apps]
		.sort((left, right) => {
			const difference = rankOf(right) - rankOf(left)
			return difference === 0
				? left.name.localeCompare(right.name)
				: difference
		})
		.slice(0, limit)
}

export function selectUnclassifiedApps(apps: AppInfo[]): AppInfo[] {
	return apps
		.filter(app => app.category === 'other')
		.sort((left, right) => left.name.localeCompare(right.name))
}

export interface CatalogCounts {
	visibleCategorizedApps: AppInfo[]
	navigationCounts: Map<string, number>
	favoriteCount: number
	hiddenCount: number
	auxiliaryCount: number
	classifiedPrimaryCount: number
	classifiedAuxiliaryCount: number
}

export function selectCatalogCounts(
	categorized: AppInfo[],
	isHidden: AppPredicate,
	isFavorite: AppPredicate,
): CatalogCounts {
	const visibleCategorizedApps: AppInfo[] = []
	const navigationCounts = new Map<string, number>()
	let favoriteCount = 0
	let hiddenCount = 0
	let auxiliaryCount = 0
	let classifiedAuxiliaryCount = 0
	for (const app of categorized) {
		const hidden = isHidden(app)
		if (hidden) hiddenCount += 1
		if (isCatalogArtifact(app)) {
			if (!hidden)
				navigationCounts.set(
					INSTALLERS_DOCS_CATEGORY,
					(navigationCounts.get(INSTALLERS_DOCS_CATEGORY) ?? 0) + 1,
				)
			continue
		}
		if (app.visibilityClass === 'auxiliary') {
			classifiedAuxiliaryCount += 1
			if (!hidden) auxiliaryCount += 1
			continue
		}
		if (hidden) continue
		visibleCategorizedApps.push(app)
		navigationCounts.set(
			app.category,
			(navigationCounts.get(app.category) ?? 0) + 1,
		)
		if (isFavorite(app)) favoriteCount += 1
	}
	return {
		visibleCategorizedApps,
		navigationCounts,
		favoriteCount,
		hiddenCount,
		auxiliaryCount,
		classifiedPrimaryCount: categorized.length - classifiedAuxiliaryCount,
		classifiedAuxiliaryCount,
	}
}
