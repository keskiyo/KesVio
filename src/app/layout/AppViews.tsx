import { useState } from 'react'
import { INSTALLERS_DOCS_CATEGORY, isCatalogView } from '../../entities/app'
import { BackupRestorePage } from '../../pages/backup-restore'
import { CatalogPage } from '../../pages/catalog'
import { CatalogHealthPage } from '../../pages/catalog-health'
import { MorePage } from '../../pages/more'
import { ScenariosPage } from '../../pages/scenarios'
import { SettingsPage } from '../../pages/settings'
import type { AppViewsProps } from '../types'

export function AppViews({
	state,
	catalog,
	derivations,
	navigation,
	scenarioRunner,
	dialogs,
	updater,
	systemClient,
	onFirstScan,
	onRefreshCatalog,
	onOpenFolder,
}: AppViewsProps) {
	const [scanPromptDismissed, setScanPromptDismissed] = useState(false)
	const { catalogApps, counts, deferredQuery, filteredApps, morePreview } =
		catalog
	const { auxiliaryCount, hiddenCount, navigationCounts } = counts

	return (
		<main className="mx-auto w-full max-w-375 px-5 pt-7 pb-12 sm:px-8">
			{state.activeView === 'more' && (
				<MorePage
					auxiliaryCount={auxiliaryCount}
					hiddenCount={hiddenCount}
					installersDocsCount={
						navigationCounts.get(INSTALLERS_DOCS_CATEGORY) ?? 0
					}
					scenarioCount={state.scenarios.length}
					catalogDiagnostics={state.catalogDiagnostics}
					isRefreshing={state.isRefreshing}
					recentApps={derivations.recentApps}
					preview={morePreview}
					scenarioRun={{
						runningId: scenarioRunner.runningId,
						isScenarioRunning: scenarioRunner.isRunning,
						onRun: scenarioRunner.runById,
						onViewAll: dialogs.scenarioLauncher.show,
					}}
					onSelectView={navigation.selectView}
				/>
			)}
			{state.activeView === 'scenarios' && (
				<ScenariosPage
					scenarios={state.scenarios}
					apps={catalogApps}
					selectableApps={catalog.primaryApps}
					categories={state.categories}
					runningId={scenarioRunner.runningId}
					isScenarioRunning={scenarioRunner.isRunning}
					runProgress={scenarioRunner.progress}
					favoriteScenarioIds={state.favoriteScenarioIds}
					onBack={() => navigation.selectView('more')}
					onCreate={state.createScenario}
					onRename={state.renameScenario}
					onSetForceClose={state.setScenarioForceClose}
					onDelete={state.deleteScenario}
					onAddApp={state.addScenarioApp}
					onRemoveApp={state.removeScenarioApp}
					onRun={scenarioRunner.run}
					onToggleFavorite={state.toggleFavoriteScenario}
				/>
			)}
			{state.activeView === 'catalog_health' && (
				<CatalogHealthPage
					diagnostics={state.catalogDiagnostics}
					isRefreshing={state.isRefreshing}
					onRefresh={onRefreshCatalog}
					onPreviewDiagnostics={systemClient.previewDiagnosticsLog}
					onExportDiagnostics={systemClient.exportDiagnosticsLog}
					onBack={() => navigation.selectView('more')}
				/>
			)}
			{state.activeView === 'backup_restore' && (
				<BackupRestorePage
					onExport={state.exportPreferences}
					onSaveExport={systemClient.savePreferencesBackup}
					onValidateImport={state.validatePreferencesImport}
					onImport={state.importPreferences}
					onRestore={state.restorePreferencesBackup}
					onBack={() => navigation.selectView('more')}
				/>
			)}
			{state.activeView === 'settings' && (
				<SettingsPage
					client={systemClient}
					density={state.catalogDensity}
					onSetDensity={state.setCatalogDensity}
					onForceFullScan={state.forceFullScan}
					onResetCatalogCache={state.resetCatalogCache}
					unclassifiedApps={derivations.unclassifiedApps}
					categories={state.categories}
					categoryOrder={state.categoryOrder}
					onMoveApp={state.moveApp}
					updater={updater}
				/>
			)}
			{isCatalogView(state.activeView) && (
				<CatalogPage
					showScanPrompt={
						!state.isLoading &&
						!state.hasCache &&
						!state.apps.length &&
						!scanPromptDismissed
					}
					scanPrompt={{
						isScanning: state.isRefreshing,
						onDismiss: () => setScanPromptDismissed(true),
						onScan: onFirstScan,
						onConfigureFolders: () =>
							navigation.selectView('settings'),
					}}
					grid={{
						apps: filteredApps,
						isLoading: state.isLoading,
						hasQuery: deferredQuery.trim().length > 0,
						activeView: state.activeView,
						searchScopeCounts: catalog.searchScopeCounts,
						onSelectView: navigation.selectView,
						onBack: () => navigation.selectView('more'),
						categoryOrder: state.categoryOrder,
						categories: state.categories,
						collapsedCategories: state.collapsedCategories,
						favoriteAppIds: state.favoriteAppIds,
						favoriteScenarios: {
							scenarios: derivations.favoriteScenarios,
							apps: catalogApps,
							runningId: scenarioRunner.runningId,
							isScenarioRunning: scenarioRunner.isRunning,
							onRun: scenarioRunner.runById,
							onToggleFavorite: state.toggleFavoriteScenario,
						},
						onToggleCategory: state.toggleCategory,
						onToggleFavorite: state.toggleFavorite,
						onMoveApp: state.moveApp,
						onLaunch: dialogs.installerLaunch.requestLaunch,
						onInfo: dialogs.appInfo.open,
						onOpenFolder,
						onManageInWindows: systemClient.openAppsSettings,
						onHide: state.hideApp,
						onRestore: state.restoreApp,
						onPromoteAuxiliary: state.promoteAuxiliary,
						onDemoteAuxiliary: state.demoteAuxiliary,
						onRenameCategory: state.renameCategory,
						onDeleteCategory: state.deleteCategory,
					}}
				/>
			)}
		</main>
	)
}
