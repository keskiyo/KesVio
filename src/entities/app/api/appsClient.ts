import type {
	AppDetails,
	AppHydrationPatch,
	AppsClient,
	CatalogDelta,
	CatalogDiagnostics,
	CatalogScanResult,
	CatalogSnapshot,
	CloseAppsResult,
	CloseProgress,
	LaunchStatus,
	ScanProgress,
} from '../model/app.types'
import {
	invokeIfTauri,
	invokeTauri,
	isTauriRuntime,
	listenIfTauri,
} from '../../../shared/api/tauri/client'

export const tauriAppsClient: AppsClient = {
	getApps: () =>
		isTauriRuntime()
			? invokeTauri<CatalogSnapshot>('get_apps')
			: Promise.resolve({ apps: [], hasCache: false }),
	refreshApps: () => invokeIfTauri<CatalogScanResult>('refresh_apps'),
	forceFullScan: () => invokeIfTauri<CatalogScanResult>('force_full_scan'),
	resetCatalogCache: () =>
		invokeIfTauri<CatalogScanResult>('reset_catalog_cache'),
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
	closeApps: (ids, allowForce = false) =>
		invokeIfTauri<CloseAppsResult>('close_apps', { ids, allowForce }),
	getAppDetails: id => invokeIfTauri<AppDetails>('get_app_details', { id }),
	openAppFolder: id => invokeIfTauri<void>('open_app_folder', { id }),
	async onCatalogDelta(handler) {
		return listenIfTauri<CatalogDelta>('catalog://delta', handler)
	},
	async onCatalogPatches(handler) {
		return listenIfTauri<AppHydrationPatch[]>('catalog://patches', handler)
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
