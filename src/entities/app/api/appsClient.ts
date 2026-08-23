import type {
	AppDetails,
	AppHydrationPatch,
	AppsClient,
	CatalogChangeSummary,
	CatalogDelta,
	CatalogDiagnostics,
	CatalogScanResult,
	CatalogSnapshot,
	CloseAppsResult,
	CloseProgress,
	LaunchStatus,
	ScanProgress,
	UninstallPreview,
} from '../model/app.types'
import {
	invokeIfTauri,
	invokeTauri,
	isTauriRuntime,
	listenIfTauri,
} from '../../../shared/api/tauri/client'

const EMPTY_SCAN: CatalogScanResult = { apps: [], generation: 0 }

export const tauriAppsClient: AppsClient = {
	getApps: () =>
		isTauriRuntime()
			? invokeTauri<CatalogSnapshot>('get_apps')
			: Promise.resolve({ apps: [], hasCache: false }),
	refreshApps: () =>
		isTauriRuntime()
			? invokeTauri<CatalogScanResult>('refresh_apps')
			: Promise.resolve(EMPTY_SCAN),
	forceFullScan: () =>
		isTauriRuntime()
			? invokeTauri<CatalogScanResult>('force_full_scan')
			: Promise.resolve(EMPTY_SCAN),
	resetCatalogCache: () =>
		isTauriRuntime()
			? invokeTauri<CatalogScanResult>('reset_catalog_cache')
			: Promise.resolve(EMPTY_SCAN),
	clearIconCache: () =>
		isTauriRuntime()
			? invokeTauri<void>('clear_icon_cache')
			: Promise.resolve(),
	hydrateVisibleIcons: ids =>
		isTauriRuntime()
			? invokeTauri<void>('hydrate_visible_icons', { ids })
			: Promise.resolve(),
	startBackgroundSync: () =>
		isTauriRuntime()
			? invokeTauri<void>('start_background_sync')
			: Promise.resolve(),
	cancelScan: () =>
		isTauriRuntime() ? invokeTauri<void>('cancel_scan') : Promise.resolve(),
	launchApp: app => invokeIfTauri<void>('launch_app', { id: app.id }),
	closeApps: ids => invokeIfTauri<CloseAppsResult>('close_apps', { ids }),
	getAppDetails: id => invokeIfTauri<AppDetails>('get_app_details', { id }),
	openAppFolder: id => invokeIfTauri<void>('open_app_folder', { id }),
	getUninstallPreview: id =>
		invokeIfTauri<UninstallPreview>('get_uninstall_preview', { id }),
	uninstallApp: id => invokeIfTauri<void>('uninstall_app', { id }),
	async onCatalogDelta(handler) {
		return listenIfTauri<CatalogDelta>('catalog://delta', handler)
	},
	async onCatalogPatches(handler) {
		return listenIfTauri<AppHydrationPatch[]>('catalog://patches', handler)
	},
	async onCatalogChanged(handler) {
		return listenIfTauri<CatalogChangeSummary>('catalog://changed', handler)
	},
	async onCatalogDiagnostics(handler) {
		return listenIfTauri<CatalogDiagnostics>(
			'catalog://diagnostics',
			handler,
		)
	},
	async onScanProgress(handler) {
		return listenIfTauri<ScanProgress>('scan://progress', handler)
	},
	async onLaunchStatus(handler) {
		return listenIfTauri<LaunchStatus>('launch://status', handler)
	},
	async onCloseProgress(handler) {
		return listenIfTauri<CloseProgress>('close://progress', handler)
	},
}
