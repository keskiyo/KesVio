import type { ActiveFilterChip } from '../../widgets/app-header'
import type { useCatalogView } from '../../widgets/catalog-content'
import type {
	AppNavigationProps,
	useCatalogNavigation,
} from '../../widgets/sidebar-navigation'
import type { useAppDerivations } from './useAppDerivations'
import type { useCatalogDialogs } from './useCatalogDialogs'
import type { AppState } from '../store/types'

interface NavigationPropsInput {
	state: AppState
	catalog: ReturnType<typeof useCatalogView>
	derivations: ReturnType<typeof useAppDerivations>
	navigation: ReturnType<typeof useCatalogNavigation>
	dialogs: ReturnType<typeof useCatalogDialogs>
}

export function useNavigationProps({
	state,
	catalog,
	derivations,
	navigation,
	dialogs,
}: NavigationPropsInput): {
	navigationProps: AppNavigationProps
	activeFilterChip: ActiveFilterChip | null
} {
	const { counts } = catalog
	const navigationProps: AppNavigationProps = {
		categoryOrder: state.categoryOrder,
		categories: state.categories,
		counts: counts.navigationCounts,
		activeView: state.activeView,
		appCount: counts.visibleCategorizedApps.length,
		favoriteCount: counts.favoriteCount,
		favoriteScenarioCount: derivations.favoriteScenarios.length,
		savedFilters: {
			filters: state.savedFilters,
			activeId: state.activeSavedFilterId,
			onSelect: state.selectSavedFilter,
			onCreate: dialogs.savedFilterEditor.create,
			onDelete: state.deleteSavedFilter,
		},
		onSelectView: navigation.selectView,
		onSelectCategory: navigation.selectCategory,
		onReorderCategory: state.reorderCategory,
		onCreateCategory: state.createCategory,
	}
	const activeFilter = catalog.activeFilter
	const activeFilterChip = activeFilter
		? {
				name: activeFilter.name,
				onEdit: () => dialogs.savedFilterEditor.edit(activeFilter),
				onClear: () => state.selectSavedFilter(null),
			}
		: null
	return { navigationProps, activeFilterChip }
}
