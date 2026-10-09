import { useMemo } from 'react'
import {
	applySavedFilter,
	type AppInfo,
	type AppLaunchStats,
	type AppView,
	type SavedFilter,
} from '../../../entities/app'
import { useNow } from '../../../shared/hooks/useNow'

interface FilterScope {
	activeView: AppView
	activeSavedFilterId?: string | null
	savedFilters?: SavedFilter[]
	firstSeenAt: Record<string, number>
	appLaunchStats: AppLaunchStats
	launchHistorySince?: number | null
}

export function useSavedFilterScope(
	state: FilterScope,
	visibleApps: AppInfo[],
) {
	const activeFilter = useMemo(
		() =>
			state.savedFilters?.find(
				filter => filter.id === state.activeSavedFilterId,
			) ?? null,
		[state.activeSavedFilterId, state.savedFilters],
	)
	const catalogScreen = !['settings', 'more', 'scenarios'].includes(
		state.activeView,
	)
	const now = useNow(
		activeFilter !== null &&
			(activeFilter.criteria.addedWithinDays !== null ||
				activeFilter.criteria.unusedForDays !== null) &&
			catalogScreen,
	)
	const launchHistorySince = state.launchHistorySince ?? null
	const scopedApps = useMemo(
		() =>
			activeFilter
				? applySavedFilter(
						visibleApps,
						activeFilter.criteria,
						state.firstSeenAt,
						now,
						{
							appLaunchStats: state.appLaunchStats,
							launchHistorySince,
						},
					)
				: visibleApps,
		[
			activeFilter,
			now,
			state.firstSeenAt,
			state.appLaunchStats,
			launchHistorySince,
			visibleApps,
		],
	)
	return { activeFilter, scopedApps }
}
