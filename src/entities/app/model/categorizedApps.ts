import { deduplicateVisibleApps } from '../lib/appDeduplication'
import { appIdentity } from '../lib/appIdentity'
import {
	INSTALLERS_DOCS_CATEGORY,
	isCatalogArtifact,
} from '../lib/catalogArtifacts'
import { type AppCategory, driveCategoryFor } from '../../category'
import type { AppInfo } from './app.types'

export interface CategorizedAppsState {
	apps: AppInfo[]
	categoryOverrides: Record<string, AppCategory>
	categoryOverrideIdentities: Record<string, AppCategory>
	promotedAppIds: string[]
	promotedAppIdentities: string[]
	installerAppIds: string[]
	installerAppIdentities: string[]
	documentAppIds: string[]
	documentAppIdentities: string[]
}

export function selectCategorizedApps(state: CategorizedAppsState): AppInfo[] {
	const promotedIds = new Set(state.promotedAppIds)
	const promotedIdentities = new Set(state.promotedAppIdentities)
	const installerIds = new Set(state.installerAppIds)
	const installerIdentities = new Set(state.installerAppIdentities)
	const documentIds = new Set(state.documentAppIds)
	const documentIdentities = new Set(state.documentAppIdentities)
	const categorize = (app: AppInfo): AppInfo => {
		const drive = driveCategoryFor(app)
		if (drive)
			return {
				...app,
				artifactKind: 'application' as const,
				category: drive.id,
				visibilityClass: 'primary' as const,
			}
		if (isCatalogArtifact(app)) {
			return app.category === INSTALLERS_DOCS_CATEGORY
				? app
				: { ...app, category: INSTALLERS_DOCS_CATEGORY }
		}
		const placedAs =
			installerIds.has(app.id) ||
			installerIdentities.has(appIdentity(app))
				? ('installer' as const)
				: documentIds.has(app.id) ||
					  documentIdentities.has(appIdentity(app))
					? ('documentation' as const)
					: null
		if (placedAs)
			return {
				...app,
				artifactKind: placedAs,
				category: INSTALLERS_DOCS_CATEGORY,
				userPlacedArtifact: true,
			}
		const override =
			state.categoryOverrideIdentities[appIdentity(app)] ??
			state.categoryOverrides[app.id]
		const category = override ?? app.category
		const safeCategory =
			category === INSTALLERS_DOCS_CATEGORY ? app.category : category
		const promote =
			app.visibilityClass === 'auxiliary' &&
			(promotedIds.has(app.id) ||
				promotedIdentities.has(appIdentity(app)))
		const manualCategory =
			override !== undefined &&
			override !== INSTALLERS_DOCS_CATEGORY &&
			safeCategory !== app.category
		if (safeCategory === app.category && !promote && !manualCategory)
			return app
		const categorized = {
			...app,
			category: safeCategory,
			...(manualCategory ? { categoryReasons: ['user=category'] } : {}),
		}
		return promote
			? {
					...categorized,
					visibilityClass: 'primary' as const,
					userPromoted: true,
				}
			: categorized
	}
	return deduplicateVisibleApps(state.apps.map(categorize))
}
