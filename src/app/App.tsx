import { useRef } from 'react'
import { Toaster } from 'sonner'
import { useStore } from 'zustand'
import { useCatalogView } from '../widgets/catalog-content'
import {
	AppDrawer,
	AppSidebar,
	useCatalogNavigation,
	useDesktopNavigation,
} from '../widgets/sidebar-navigation'

import { AppShellChrome } from './layout/AppShellChrome'
import { Header } from '../widgets/app-header'
import { useAppFeedback } from './model/useAppFeedback'
import { useActivityStatus } from './model/useActivityStatus'
import { useAppDerivations } from './model/useAppDerivations'
import { useCatalogDialogs } from './model/useCatalogDialogs'
import { AppDialogs } from './layout/AppDialogs'
import { AppViews } from './layout/AppViews'
import { useCatalogBootstrap } from './model/useCatalogBootstrap'
import { useDrawer } from './model/useDrawer'
import { useScenarioIntegration } from './model/useScenarioIntegration'
import { useSearchAccess } from './model/useSearchAccess'
import { useTrayCatalogScan } from './model/useTrayCatalogScan'
import { useTrayFavorites } from './model/useTrayFavorites'
import { useTraySearch } from './model/useTraySearch'

import { useGlobalShortcuts } from './model/useGlobalShortcuts'
import { useStaleCopy } from '../features/stale-copy'
import { useUpdater } from '../features/update-app'
import { AppStoreProvider } from './store/storeContext'
import type { AppProps } from './types'

export function App({ store, systemClient, appsClient }: AppProps) {
	const state = useStore(store)
	const {
		activeView,
		error,
		hydrateVisibleIcons,
		initialize,
		isLoading,
		isRefreshing,
		preferencesPersisted,
	} = state
	const catalog = useCatalogView(state)
	const {
		catalogApps,
		counts,
		filteredApps,
		primaryApps,
		visibleHydrationIds,
	} = catalog
	const derivations = useAppDerivations({
		catalogApps,
		primaryApps,
		firstSeenAt: state.firstSeenAt,
		scenarios: state.scenarios,
		favoriteScenarioIds: state.favoriteScenarioIds,
	})
	const desktopNavigation = useDesktopNavigation()
	const drawer = useDrawer(desktopNavigation)
	const menuButtonRef = useRef<HTMLButtonElement>(null)
	const feedback = useAppFeedback({
		onLaunch: state.launch,
		onRefresh: state.refresh,
		onFullScan: state.forceFullScan,
		onUndo: state.undo,
	})
	const dialogs = useCatalogDialogs({
		systemClient,
		onLaunch: feedback.launch,
	})
	const navigation = useCatalogNavigation({
		collapsedCategories: state.collapsedCategories,
		activeView,
		setActiveView: state.setActiveView,
		toggleCategory: state.toggleCategory,
		closeDrawer: drawer.close,
		isCatalogReady: !isLoading && activeView === 'all',
	})

	useCatalogBootstrap({
		initialize,
		error,
		isLoading,
		catalogGeneration: state.catalogGeneration,
		visibleHydrationIds,
		hydrateVisibleIcons,
	})

	const isCatalogView =
		activeView !== 'settings' &&
		activeView !== 'more' &&
		activeView !== 'scenarios'
	const search = useSearchAccess({
		isCatalogView,
		setQuery: state.setQuery,
		selectView: navigation.selectView,
	})
	useGlobalShortcuts({
		onToggleQuickLaunch: dialogs.palette.toggle,
		onToggleScenarios: dialogs.scenarioLauncher.toggle,
		onSearchFromShortcut: search.select,
		onFocusSearch: search.focus,
		onUndo: state.undoable ? feedback.undo : undefined,
	})

	const scenarios = useScenarioIntegration({
		state,
		catalogApps,
		appsClient,
		systemClient,
		onFinished: feedback.reportScenarioRun,
	})
	useTrayCatalogScan({
		systemClient,
		busy: isLoading || isRefreshing,
		onForceFullScan: state.forceFullScan,
	})
	useTrayFavorites({
		systemClient,
		apps: state.apps,
		favoriteAppIds: state.favoriteAppIds,
		onLaunch: feedback.launch,
		selectView: navigation.selectView,
	})
	useTraySearch({
		systemClient,
		isCatalogView,
		onSearch: search.select,
		selectView: navigation.selectView,
	})

	const { auxiliaryCount, favoriteCount, navigationCounts } = counts
	const appCount = counts.visibleCategorizedApps.length
	const navigationProps = {
		categoryOrder: state.categoryOrder,
		categories: state.categories,
		counts: navigationCounts,
		activeView: state.activeView,
		appCount,
		favoriteCount,
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

	const activity = useActivityStatus({
		apps: state.apps,
		launchingIds: state.launchingIds,
		isRefreshing: state.isRefreshing,
	})
	const updater = useUpdater()
	const { dismiss: dismissStaleCopy, staleCopy } = useStaleCopy(systemClient)

	return (
		<AppStoreProvider store={store}>
			<div
				data-density={state.catalogDensity}
				className="app-shell theme-graphite-surface flex h-screen flex-col overflow-hidden"
			>
				<AppShellChrome
					activityActive={activity.active}
					activityLabel={activity.label}
					preferencesPersisted={preferencesPersisted}
					staleCopy={staleCopy}
					systemClient={systemClient}
					updater={updater}
					onDismissStaleCopy={dismissStaleCopy}
				/>
				<div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
					{desktopNavigation && (
						<AppSidebar
							{...navigationProps}
							onGoHome={navigation.goHome}
						/>
					)}
					<div
						id="catalog-scroll"
						className="app-panel flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-2xl"
					>
						<Header
							primaryAppCount={appCount}
							auxiliaryToolCount={auxiliaryCount}
							visibleCount={filteredApps.length}
							query={state.query}
							isRefreshing={state.isRefreshing}
							scanProgress={state.scanProgress}
							activeFilter={activeFilterChip}
							onQueryChange={search.changeQuery}
							onRefresh={feedback.refresh}
							onCancelScan={state.cancelScan}
							menuButtonRef={menuButtonRef}
							searchInputRef={search.searchInputRef}
							onOpenNavigation={drawer.onOpen}
							showMenu={!desktopNavigation}
						/>
						<AppViews
							state={state}
							catalog={catalog}
							derivations={derivations}
							navigation={navigation}
							scenarioRunner={scenarios.runner}
							dialogs={dialogs}
							updater={updater}
							systemClient={systemClient}
							onFirstScan={feedback.fullScan}
							onRefreshCatalog={feedback.refresh}
						/>
					</div>
				</div>
				{drawer.mounted && !desktopNavigation && (
					<AppDrawer
						{...navigationProps}
						open={drawer.open}
						triggerRef={menuButtonRef}
						onGoHome={navigation.goHome}
						onClose={drawer.close}
						onExited={drawer.onExited}
					/>
				)}
				<AppDialogs
					appsClient={appsClient}
					categories={state.categories}
					dialogs={dialogs}
					paletteApps={primaryApps}
					paletteSuggestions={catalog.paletteSuggestions}
					scenarioLauncher={scenarios.launcher}
					savedFilterEditor={{
						publishers: derivations.publishers,
						onCreate: state.createSavedFilter,
						onUpdate: state.updateSavedFilter,
						onDelete: state.deleteSavedFilter,
					}}
					onError={dialogs.reportFailure}
				/>
				<Toaster
					className="app-toaster"
					theme="dark"
					position="bottom-right"
					expand
					visibleToasts={5}
					gap={10}
					offset={16}
					closeButton
				/>
			</div>
		</AppStoreProvider>
	)
}
