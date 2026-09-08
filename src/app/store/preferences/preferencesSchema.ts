import {
	type CatalogDensity,
	DEFAULT_CATALOG_DENSITY,
} from '../../../entities/app'
import {
	type AppCategory,
	CATEGORY_ORDER,
	type CategoryDefinition,
	DEFAULT_CATEGORIES,
} from '../../../entities/category'
import type { Scenario } from '../../../entities/scenario'

export const PREFERENCES_KEY = 'kesvio.preferences.v1'

export const CURRENT_PREFERENCES_VERSION = 19

export const PREFERENCES_BACKUP_KEY = 'kesvio.preferences.v1.bak'

export interface LegacyCanonicalPreferences {
	favorite: string[]
	hidden: string[]
	promoted: string[]
	installer: string[]
	document: string[]
	categoryOverrides: Record<string, AppCategory>
}

export interface AppPreferencesV19 {
	version: 19
	catalogDensity: CatalogDensity
	categories: CategoryDefinition[]
	categoryOrder: AppCategory[]
	favoriteAppIds: string[]
	favoriteAppIdentities: string[]
	collapsedCategories: AppCategory[]
	categoryOverrides: Record<string, AppCategory>
	categoryOverrideIdentities: Record<string, AppCategory>
	hiddenAppIds: string[]
	hiddenAppIdentities: string[]
	promotedAppIds: string[]
	promotedAppIdentities: string[]
	installerAppIds: string[]
	installerAppIdentities: string[]
	documentAppIds: string[]
	documentAppIdentities: string[]
	scenarios: Scenario[]
	favoriteScenarioIds: string[]
	firstSeenAt: Record<string, number>
	legacyCanonicalPreferences: LegacyCanonicalPreferences
	unknownFields?: Record<string, unknown>
}

export type PreferenceTransferResult =
	{ ok: true } | { ok: false; error: string }

export type PreferenceImportResult =
	{ ok: true; preferences: AppPreferencesV19 } | { ok: false; error: string }

export const DEFAULT_PREFERENCES: AppPreferencesV19 = {
	version: 19,
	catalogDensity: DEFAULT_CATALOG_DENSITY,
	categories: DEFAULT_CATEGORIES.map(category => ({ ...category })),
	categoryOrder: [...CATEGORY_ORDER],
	favoriteAppIds: [],
	favoriteAppIdentities: [],
	collapsedCategories: [],
	categoryOverrides: {},
	categoryOverrideIdentities: {},
	hiddenAppIds: [],
	hiddenAppIdentities: [],
	promotedAppIds: [],
	promotedAppIdentities: [],
	installerAppIds: [],
	installerAppIdentities: [],
	documentAppIds: [],
	documentAppIdentities: [],
	scenarios: [],
	favoriteScenarioIds: [],
	firstSeenAt: {},
	legacyCanonicalPreferences: {
		favorite: [],
		hidden: [],
		promoted: [],
		installer: [],
		document: [],
		categoryOverrides: {},
	},
}
