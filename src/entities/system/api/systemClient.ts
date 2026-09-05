import { open } from '@tauri-apps/plugin-dialog'
import type { SystemClient } from '../model/system.types'
import { invokeTauri } from '../../../shared/api/tauri/client'

export const tauriSystemClient: SystemClient = {
	getSettings: () => invokeTauri('get_system_settings'),
	setScanSettings: settings => invokeTauri('set_scan_settings', { settings }),
	setCloseBehavior: hideToTray =>
		invokeTauri('set_close_behavior', { hideToTray }),
	savePreferencesBackup: contents =>
		invokeTauri('save_preferences_backup', { contents }),
	exportDiagnosticsLog: () => invokeTauri('export_diagnostics_log'),
	pickFolder: () =>
		open({ directory: true }).then(result =>
			typeof result === 'string' ? result : null,
		),
	openTelegram: () => invokeTauri('open_telegram'),
	openGithub: () => invokeTauri('open_github'),
	openAppsSettings: () => invokeTauri('open_apps_settings'),
	openStartupSettings: () => invokeTauri('open_startup_settings'),
	openRelease: version => invokeTauri('open_release', { version }),
	staleCopyStatus: () => invokeTauri('stale_copy_status'),
	openInstalledCopy: () => invokeTauri('open_installed_copy'),
	logClientError: (kind, detail) =>
		invokeTauri('log_client_error', { kind, detail }),
}
