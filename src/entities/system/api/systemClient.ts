import { open } from '@tauri-apps/plugin-dialog'
import type { SystemClient } from '../model/system.types'
import {
	invokeIfTauri,
	invokeTauri,
	isTauriRuntime,
	listenIfTauri,
} from '../../../shared/api/tauri/client'

export const tauriSystemClient: SystemClient = {
	getSettings: () => invokeTauri('get_system_settings'),
	setScanSettings: settings => invokeTauri('set_scan_settings', { settings }),
	setCloseBehavior: hideToTray =>
		invokeTauri('set_close_behavior', { hideToTray }),
	savePreferencesBackup: contents =>
		invokeTauri('save_preferences_backup', { contents }),
	exportDiagnosticsLog: () => invokeTauri('export_diagnostics_log'),
	previewDiagnosticsLog: () => invokeTauri('preview_diagnostics_log'),
	pickFolder: () =>
		open({ directory: true }).then(result =>
			typeof result === 'string' ? result : null,
		),
	openTelegram: () => invokeTauri('open_telegram'),
	openGithub: () => invokeTauri('open_github'),
	openAppsSettings: () => invokeTauri('open_apps_settings'),
	setStartupEnabled: enabled =>
		invokeTauri('set_startup_enabled', { enabled }),
	openRelease: version => invokeTauri('open_release', { version }),
	staleCopyStatus: () => invokeTauri('stale_copy_status'),
	openInstalledCopy: () => invokeTauri('open_installed_copy'),
	logClientError: (kind, detail) =>
		invokeTauri('log_client_error', { kind, detail }),
	setTrayScenarios: entries =>
		invokeIfTauri('set_tray_scenarios', { entries }),
	setTrayRunning: label => invokeIfTauri('set_tray_running', { label }),
	setTrayScanState: busy => invokeIfTauri('set_tray_scan_state', { busy }),
	onTrayForceFullScan: handler =>
		listenIfTauri<null>('tray://force-full-scan', handler),
	onTrayScenarioRun: handler =>
		listenIfTauri<{ id: string }>('tray://run-scenario', payload =>
			handler(payload.id),
		),
	setTrayFavorites: (entries, more) =>
		invokeIfTauri('set_tray_favorites', { entries, more }),
	onTrayLaunchApp: handler =>
		listenIfTauri<{ id: string }>('tray://launch-app', payload =>
			handler(payload.id),
		),
	onTrayShowFavorites: handler =>
		listenIfTauri<null>('tray://show-favorites', handler),
	onTraySearch: handler => listenIfTauri<null>('tray://search', handler),
	takeTraySearchIntent: () =>
		isTauriRuntime()
			? invokeTauri<boolean>('take_tray_search_intent')
			: Promise.resolve(false),
}
