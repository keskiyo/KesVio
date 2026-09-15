import type { TrayScenarioEntry } from '../../scenario'

export interface GlobalShortcutStatus {
	available: boolean
	label: string
	error: string | null
}

export type StartupEntryState = 'enabled' | 'disabled' | 'missing'

export interface SystemSettings {
	version: string
	shortcut: GlobalShortcutStatus
	scanSettings: ScanSettings
	fixedDrives: string[]
	hideToTrayOnClose: boolean
	startupEntry: StartupEntryState
}

export interface ScanSettings {
	autoScanFixedDrives: boolean
	includedPaths: string[]
	excludedPaths: string[]
}

export interface TrayFavoriteEntry {
	id: string
	label: string
}

export interface SystemClient {
	getSettings(): Promise<SystemSettings>
	setScanSettings(settings: ScanSettings): Promise<ScanSettings>
	setCloseBehavior(hideToTray: boolean): Promise<boolean>
	savePreferencesBackup(contents: string): Promise<boolean>
	exportDiagnosticsLog(): Promise<boolean>
	previewDiagnosticsLog(): Promise<string>
	pickFolder(): Promise<string | null>
	openTelegram(): Promise<void>
	openGithub(): Promise<void>
	openAppsSettings(): Promise<void>
	setStartupEnabled(enabled: boolean): Promise<StartupEntryState>
	openRelease?(version: string): Promise<void>
	staleCopyStatus?(): Promise<StaleCopyInfo | null>
	openInstalledCopy?(): Promise<void>
	logClientError?(kind: string, detail: string): Promise<void>
	setTrayScenarios?(entries: TrayScenarioEntry[]): Promise<void>
	setTrayRunning?(label: string | null): Promise<void>
	onTrayScenarioRun?(handler: (id: string) => void): Promise<() => void>
	setTrayScanState?(busy: boolean): Promise<void>
	onTrayForceFullScan?(handler: () => void): Promise<() => void>
	setTrayFavorites?(
		entries: TrayFavoriteEntry[],
		more: boolean,
	): Promise<void>
	onTrayLaunchApp?(handler: (id: string) => void): Promise<() => void>
	onTrayShowFavorites?(handler: () => void): Promise<() => void>
	onTraySearch?(handler: () => void): Promise<() => void>
	takeTraySearchIntent?(): Promise<boolean>
}

export interface StaleCopyInfo {
	installedVersion: string
	installLocation: string
}
