import type { TrayScenarioEntry } from '../../scenario'

export interface GlobalShortcutStatus {
	available: boolean
	label: string
	error: string | null
}

export interface SystemSettings {
	version: string
	shortcut: GlobalShortcutStatus
	scanSettings: ScanSettings
	fixedDrives: string[]
	hideToTrayOnClose: boolean
}

export interface ScanSettings {
	autoScanFixedDrives: boolean
	includedPaths: string[]
	excludedPaths: string[]
}

export interface SystemClient {
	getSettings(): Promise<SystemSettings>
	setScanSettings(settings: ScanSettings): Promise<ScanSettings>
	setCloseBehavior(hideToTray: boolean): Promise<boolean>
	savePreferencesBackup(contents: string): Promise<boolean>
	exportDiagnosticsLog(): Promise<boolean>
	pickFolder(): Promise<string | null>
	openTelegram(): Promise<void>
	openGithub(): Promise<void>
	openAppsSettings(): Promise<void>
	openStartupSettings(): Promise<void>
	openRelease?(version: string): Promise<void>
	staleCopyStatus?(): Promise<StaleCopyInfo | null>
	openInstalledCopy?(): Promise<void>
	logClientError?(kind: string, detail: string): Promise<void>
	setTrayScenarios?(entries: TrayScenarioEntry[]): Promise<void>
	setTrayRunning?(label: string | null): Promise<void>
	onTrayScenarioRun?(handler: (id: string) => void): Promise<() => void>
	setTrayScanState?(busy: boolean): Promise<void>
	onTrayForceFullScan?(handler: () => void): Promise<() => void>
}

export interface StaleCopyInfo {
	installedVersion: string
	installLocation: string
}
