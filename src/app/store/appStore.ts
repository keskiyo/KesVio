import { createStore, type StoreApi } from 'zustand/vanilla'
import { createAppearanceActions } from './actions/appearanceActions'
import { createAppMarkActions } from './actions/appMarkActions'
import { createAppPlacementActions } from './actions/appPlacementActions'
import { createCatalogActions } from './actions/catalogActions'
import { createCatalogSyncActions } from './actions/catalogSyncActions'
import { createCategoryActions } from './actions/categoryActions'
import { createIconActions } from './actions/iconActions'
import { createLaunchActions } from './actions/launchActions'
import { createLifecycleActions } from './actions/lifecycleActions'
import { createPersist } from './persist'
import { createPreferenceTransferActions } from './actions/preferenceTransferActions'
import { createSavedFilterActions } from './actions/savedFilterActions'
import { createScenarioActions } from './actions/scenarioActions'
import { createScenarioPolicyActions } from './actions/scenarioPolicyActions'
import { createScenarioImportActions } from './actions/scenarioImportActions'
import { createTransaction } from './transaction'
import { createUndoActions } from './actions/undoActions'
import { readPreferences } from './preferences'
import type { AppPreferencesV22 } from './preferences'
import type { AppsClient } from '../../entities/app'
import type { AppState } from './types'

function initialState(preferences: AppPreferencesV22) {
	return {
		apps: [],
		query: '',
		isLoading: true,
		isRefreshing: false,
		scanProgress: null,
		hasCache: false,
		catalogGeneration: 0,
		catalogDiagnostics: null,
		error: null,
		activeView: 'all' as const,
		catalogDensity: preferences.catalogDensity,
		favoriteAppIds: preferences.favoriteAppIds,
		favoriteAppIdentities: preferences.favoriteAppIdentities,
		categoryOrder: preferences.categoryOrder,
		collapsedCategories: preferences.collapsedCategories,
		categoryOverrides: preferences.categoryOverrides,
		categoryOverrideIdentities: preferences.categoryOverrideIdentities,
		hiddenAppIds: preferences.hiddenAppIds,
		hiddenAppIdentities: preferences.hiddenAppIdentities,
		promotedAppIds: preferences.promotedAppIds,
		promotedAppIdentities: preferences.promotedAppIdentities,
		installerAppIds: preferences.installerAppIds,
		installerAppIdentities: preferences.installerAppIdentities,
		documentAppIds: preferences.documentAppIds,
		documentAppIdentities: preferences.documentAppIdentities,
		scenarios: preferences.scenarios,
		favoriteScenarioIds: preferences.favoriteScenarioIds,
		firstSeenAt: preferences.firstSeenAt,
		savedFilters: preferences.savedFilters,
		activeSavedFilterId: null,
		legacyCanonicalPreferences: preferences.legacyCanonicalPreferences,
		unknownPreferenceFields: preferences.unknownFields ?? {},
		preferencesPersisted: true,
		preferencesRevision: 0,
		undoable: null,
		categories: preferences.categories,
		launchingIds: [],
	}
}

export function createAppStore(
	client: AppsClient,
	storage: Storage = globalThis.localStorage,
	idFactory: () => string = () => `custom:${crypto.randomUUID()}`,
): StoreApi<AppState> {
	const preferences = readPreferences(storage)
	return createStore<AppState>((set, get) => {
		const persist = createPersist({
			set,
			get,
			storage,
		})
		const transact = createTransaction({ set, get, persist })
		return {
			...initialState(preferences),
			...createLifecycleActions({ set, get, client }),
			...createCatalogActions({ set, get, client, persist }),
			...createCatalogSyncActions({ set, get, persist }),
			...createIconActions({ get, client }),
			...createLaunchActions({ set, get, client }),
			...createAppearanceActions({ set, persist }),
			...createAppMarkActions({ set, get, persist, transact }),
			...createAppPlacementActions({ set, get, transact }),
			...createCategoryActions({
				set,
				get,
				persist,
				transact,
				idFactory,
			}),
			...createScenarioActions({
				set,
				get,
				persist,
				transact,
				idFactory,
			}),
			...createScenarioPolicyActions({ set, get, transact }),
			...createScenarioImportActions({
				set,
				get,
				transact,
				storage,
				idFactory,
			}),
			...createSavedFilterActions({ set, get, transact, idFactory }),
			...createPreferenceTransferActions({ set, get, persist, storage }),
			...createUndoActions({ set, get, persist }),
		}
	})
}

export type { AppState } from './types'

export {
	filterAppsByQuery,
	filterVisibleApps,
	rankAppsByQuery,
	rankAppsByQueryTop,
	selectCatalogCounts,
	selectCategorizedApps,
	selectFilteredApps,
	selectVisibleApps,
} from './selectors'
