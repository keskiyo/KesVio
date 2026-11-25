import { useCallback, useRef, useState } from 'react'
import { useStore } from 'zustand'
import {
	isCatalogView,
	joinHydrationIds,
	splitHydrationIds,
} from '../entities/app'
import {
	focusFirstLaunchTarget,
	useCardNavigation,
	useCatalogView,
} from '../widgets/catalog-content'
import {
	AppDrawer,
	AppSidebar,
	useCatalogNavigation,
	useDesktopNavigation,
} from '../widgets/sidebar-navigation'

import { AppShellChrome } from './layout/AppShellChrome'
import { AppToaster } from './layout/AppToaster'
import { Header } from '../widgets/app-header'
import { useAppFeedback } from './model/useAppFeedback'
import { useActivityStatus } from './model/useActivityStatus'
import { useAppDerivations } from './model/useAppDerivations'
import { useCatalogDialogs } from './model/useCatalogDialogs'
import { useNavigationIdentity } from './model/useNavigationIdentity'
import { useNavigationProps } from './model/useNavigationProps'
import { usePreloadSecondaryPages } from './model/usePreloadSecondaryPages'
import { useRememberedView } from './model/useRememberedView'
import { AppDialogs } from './layout/AppDialogs'
import { AppViews } from './layout/AppViews'
import { useCatalogBootstrap } from './model/useCatalogBootstrap'
import { useDrawer } from './model/useDrawer'
import { useScenarioIntegration } from './model/useScenarioIntegration'
import { useSearchAccess } from './model/useSearchAccess'
import { useShortcutNotice } from './model/useShortcutNotice'
import { useTrayCatalogScan } from './model/useTrayCatalogScan'
import { useTrayFavorites } from './model/useTrayFavorites'
import { useTrayRecent } from './model/useTrayRecent'
import { useTraySearch } from './model/useTraySearch'
import { useUpdateFailureNotice } from './model/useUpdateFailureNotice'
import { useWindowBackdrop } from './model/useWindowBackdrop'
import { useDriveScanOffers } from './model/useDriveScanOffers'

import { useGlobalShortcuts } from './model/useGlobalShortcuts'
import { useKeyboardLaunch } from './model/useKeyboardLaunch'
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
	const navigation = useCatalogNavigation({
		collapsedCategories: state.collapsedCategories,
		activeView,
		setActiveView: state.setActiveView,
		toggleCategory: state.toggleCategory,
		closeDrawer: drawer.close,
		isCatalogReady: !isLoading && activeView === 'all',
	})
	const selectView = navigation.selectView
	const openCatalogHealth = useCallback(
		() => selectView('catalog_health'),
		[selectView],
	)
	const feedback = useAppFeedback({
		onLaunch: state.launch,
		onOpenFolder: appsClient.openAppFolder,
		onLaunchElevated: appsClient.launchAppElevated
			? state.launchElevated
			: undefined,
		onCanLaunchElevated: appsClient.canLaunchElevated,
		onRefresh: state.refresh,
		onFullScan: state.forceFullScan,
		onOpenCatalogHealth: openCatalogHealth,
		onUndo: state.undo,
	})
	const dialogs = useCatalogDialogs({
		systemClient,
		onLaunch: feedback.launch,
	})
	useRememberedView({ activeView, setActiveView: state.setActiveView })
	useShortcutNotice({ systemClient, selectView: navigation.selectView })
	usePreloadSecondaryPages(!isLoading)
	useWindowBackdrop(systemClient)
	useDriveScanOffers(systemClient, state.refresh)

	useCatalogBootstrap({
		initialize,
		error,
		isLoading,
		catalogGeneration: state.catalogGeneration,
		visibleHydrationIds:
			activeView === 'more'
				? joinHydrationIds([
						...splitHydrationIds(visibleHydrationIds),
						...derivations.recentApps.map(entry => entry.app.id),
					])
				: visibleHydrationIds,
		hydrateVisibleIcons,
	})

	const search = useSearchAccess({
		isCatalogView: isCatalogView(activeView),
		setQuery: state.setQuery,
		selectView: navigation.selectView,
	})
	const catalogScrollRef = useRef<HTMLDivElement>(null)
	const [scrolled, setScrolled] = useState(false)
	const scrollToTop = () =>
		catalogScrollRef.current?.scrollTo({
			top: 0,
			behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
				.matches
				? 'instant'
				: 'smooth',
		})
	const focusResults = useCallback(
		() => focusFirstLaunchTarget(catalogScrollRef.current),
		[],
	)
	const keyboard = useKeyboardLaunch({
		query: state.query,
		deferredQuery: catalog.deferredQuery,
		results: filteredApps,
		catalogApps,
		hiddenAppIds: state.hiddenAppIds,
		hiddenAppIdentities: state.hiddenAppIdentities,
		fileActions: feedback.fileActions,
		onLaunch: dialogs.installerLaunch.requestLaunch,
		onFocusResults: focusResults,
	})
	useCardNavigation({
		containerRef: catalogScrollRef,
		onLeaveTop: search.focus,
		onElevate: keyboard.elevateById,
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
		onOpenCatalogHealth: openCatalogHealth,
	})
	useTrayFavorites({
		systemClient,
		apps: state.apps,
		favoriteAppIds: state.favoriteAppIds,
		onLaunch: feedback.launch,
		selectView: navigation.selectView,
	})
	useTrayRecent({
		systemClient,
		apps: state.apps,
		appLaunchStats: state.appLaunchStats,
		hiddenAppIds: state.hiddenAppIds,
		hiddenAppIdentities: state.hiddenAppIdentities,
	})
	useTraySearch({
		systemClient,
		isCatalogView: isCatalogView(activeView),
		onSearch: search.select,
		selectView: navigation.selectView,
	})

	const { navigationProps, activeFilterChip } = useNavigationProps({
		state,
		catalog,
		derivations,
		navigation,
		dialogs,
	})

	const activity = useActivityStatus({
		apps: state.apps,
		launchingIds: state.launchingIds,
		isRefreshing: state.isRefreshing,
	})
	const updater = useUpdater()
	const identity = useNavigationIdentity({ systemClient, updater })
	useUpdateFailureNotice({ systemClient, updater })
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
					update={desktopNavigation ? null : identity.update}
					systemClient={systemClient}
					onDismissStaleCopy={dismissStaleCopy}
				/>
				<div
					className={`grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] ${desktopNavigation ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1'}`}
				>
					{desktopNavigation && (
						<AppSidebar
							{...navigationProps}
							identity={identity}
							onGoHome={navigation.goHome}
						/>
					)}
					<div className="catalog-canvas row-span-2 grid min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-subgrid overflow-hidden">
						<Header
							primaryAppCount={navigationProps.appCount}
							auxiliaryToolCount={counts.auxiliaryCount}
							visibleCount={filteredApps.length}
							query={state.query}
							isRefreshing={state.isRefreshing}
							scanProgress={state.scanProgress}
							activeFilter={activeFilterChip}
							onQueryChange={value => {
								if (catalogScrollRef.current?.scrollTop)
									catalogScrollRef.current.scrollTo({
										top: 0,
										behavior: 'instant',
									})
								search.changeQuery(value)
							}}
							onRefresh={feedback.refresh}
							onCancelScan={state.cancelScan}
							menuButtonRef={menuButtonRef}
							searchInputRef={search.searchInputRef}
							onOpenNavigation={drawer.onOpen}
							showMenu={!desktopNavigation}
							searchLaunch={keyboard.searchLaunch}
							onScrollToTop={scrolled ? scrollToTop : undefined}
						/>
						<div
							ref={catalogScrollRef}
							id="catalog-scroll"
							onScroll={event =>
								setScrolled(event.currentTarget.scrollTop > 200)
							}
							className="min-h-0 overflow-x-hidden overflow-y-auto"
						>
							<AppViews
								state={state}
								bestMatch={keyboard.bestMatch}
								catalog={catalog}
								derivations={derivations}
								navigation={navigation}
								scenarioRunner={scenarios.runner}
								dialogs={dialogs}
								updater={updater}
								systemClient={systemClient}
								onFirstScan={feedback.fullScan}
								onForceFullScan={feedback.confirmedFullScan}
								onRefreshCatalog={feedback.refresh}
								onOpenFolder={feedback.openFolder}
								fileActions={feedback.fileActions}
							/>
						</div>
					</div>
				</div>
				{drawer.mounted && !desktopNavigation && (
					<AppDrawer
						{...navigationProps}
						open={drawer.open}
						triggerRef={menuButtonRef}
						identity={{ version: identity.version, update: null }}
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
					onLaunchElevated={app => void keyboard.elevate(app)}
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
				<AppToaster />
			</div>
		</AppStoreProvider>
	)
}
