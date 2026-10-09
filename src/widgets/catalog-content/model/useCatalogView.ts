import { useDeferredValue, useMemo } from 'react'
import {
	type AppLaunchStats,
	type AppView,
	type CategorizedAppsState,
	filterVisibleApps,
	isCatalogArtifact,
	joinHydrationIds,
	type SavedFilter,
	selectCatalogCounts,
	useSearchIndex,
} from '../../../entities/app'
import type { CategoryDefinition } from '../../../entities/category'
import type { Scenario } from '../../../entities/scenario'
import { useCategorizedCatalog } from './useCategorizedCatalog'
import { useSavedFilterScope } from './useSavedFilterScope'
import {
	selectHydrationApps,
	selectShownScenarioApps,
} from '../lib/hydrationTargets'
import { buildMorePreview } from '../lib/morePreview'
import { buildPaletteSuggestions } from '../lib/paletteSuggestions'

export type { MorePreview, MorePreviewItem } from '../lib/morePreview'

interface CatalogViewState extends CategorizedAppsState {
	activeView: AppView
	categories: CategoryDefinition[]
	favoriteAppIds: string[]
	favoriteAppIdentities: string[]
	firstSeenAt: Record<string, number>
	appLaunchStats: AppLaunchStats
	launchHistorySince?: number | null
	hiddenAppIds: string[]
	hiddenAppIdentities: string[]
	query: string
	scenarios: Scenario[]
	favoriteScenarioIds: string[]
	savedFilters?: SavedFilter[]
	activeSavedFilterId?: string | null
}

export function useCatalogView(state: CatalogViewState) {
	const { categorizedApps, isHidden, isFavorite } =
		useCategorizedCatalog(state)
	const visibleApps = useMemo(
		() =>
			filterVisibleApps(
				categorizedApps,
				state.activeView,
				isHidden,
				isFavorite,
			),
		[categorizedApps, state.activeView, isHidden, isFavorite],
	)
	const catalogApps = useMemo(
		() =>
			categorizedApps.filter(
				app => !isHidden(app) && !isCatalogArtifact(app),
			),
		[categorizedApps, isHidden],
	)
	const primaryApps = useMemo(
		() => catalogApps.filter(app => app.visibilityClass !== 'auxiliary'),
		[catalogApps],
	)
	const paletteSuggestions = useMemo(
		() =>
			buildPaletteSuggestions({
				apps: primaryApps,
				favoriteAppIds: state.favoriteAppIds,
				firstSeenAt: state.firstSeenAt,
				appLaunchStats: state.appLaunchStats,
				now: Date.now(),
			}),
		[
			primaryApps,
			state.favoriteAppIds,
			state.firstSeenAt,
			state.appLaunchStats,
		],
	)
	const deferredQuery = useDeferredValue(state.query)
	const search = useSearchIndex()
	const { activeFilter, scopedApps } = useSavedFilterScope(state, visibleApps)
	const filteredApps = useMemo(
		() =>
			search.rankAppsByQueryAndCategory(
				scopedApps,
				deferredQuery,
				state.categories,
			),
		[scopedApps, deferredQuery, state.categories, search],
	)
	const counts = useMemo(
		() => selectCatalogCounts(categorizedApps, isHidden, isFavorite),
		[categorizedApps, isHidden, isFavorite],
	)
	const searchScopeCounts = useMemo(
		() =>
			search.selectSearchScopeCounts(
				categorizedApps,
				deferredQuery,
				state.hiddenAppIds,
			),
		[categorizedApps, deferredQuery, state.hiddenAppIds, search],
	)
	const morePreview = useMemo(
		() =>
			buildMorePreview({
				categorizedApps,
				favoriteAppIds: state.favoriteAppIds,
				firstSeenAt: state.firstSeenAt,
				hiddenAppIds: state.hiddenAppIds,
				scenarios: state.scenarios,
			}),
		[
			categorizedApps,
			state.favoriteAppIds,
			state.firstSeenAt,
			state.hiddenAppIds,
			state.scenarios,
		],
	)
	const scenarioApps = useMemo(
		() =>
			selectShownScenarioApps({
				activeView: state.activeView,
				scenarios: state.scenarios,
				favoriteScenarioIds: state.favoriteScenarioIds,
				catalogApps,
			}),
		[
			catalogApps,
			state.activeView,
			state.favoriteScenarioIds,
			state.scenarios,
		],
	)
	const hydrationApps = useMemo(
		() =>
			selectHydrationApps({
				activeView: state.activeView,
				filteredApps,
				morePreview,
				primaryApps,
				scenarioApps,
			}),
		[
			filteredApps,
			morePreview,
			primaryApps,
			scenarioApps,
			state.activeView,
		],
	)
	const visibleHydrationIds = useMemo(
		() => joinHydrationIds(hydrationApps.map(app => app.id)),
		[hydrationApps],
	)

	return {
		activeFilter,
		catalogApps,
		counts,
		deferredQuery,
		filteredApps,
		morePreview,
		primaryApps,
		paletteSuggestions,
		searchScopeCounts,
		visibleHydrationIds,
	}
}
