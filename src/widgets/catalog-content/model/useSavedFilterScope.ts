import { useMemo } from 'react'
import {
	applySavedFilter,
	type AppInfo,
	type AppView,
	type SavedFilter,
} from '../../../entities/app'
import { useNow } from '../../../shared/hooks/useNow'

interface FilterScope {
	activeView: AppView
	activeSavedFilterId?: string | null
	savedFilters?: SavedFilter[]
	firstSeenAt: Record<string, number>
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
			activeFilter.criteria.addedWithinDays !== null &&
			catalogScreen,
	)
	const scopedApps = useMemo(
		() =>
			activeFilter
				? applySavedFilter(
						visibleApps,
						activeFilter.criteria,
						state.firstSeenAt,
						now,
					)
				: visibleApps,
		[activeFilter, now, state.firstSeenAt, visibleApps],
	)
	return { activeFilter, scopedApps }
}
