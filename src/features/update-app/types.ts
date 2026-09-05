export type UpdateCheckStatus =
	'idle' | 'checking' | 'current' | 'available' | 'error'
export type UpdateInstallPhase =
	| 'idle'
	| 'downloading'
	| 'verifying'
	| 'installing'
	| 'restarting'
	| 'failed'

export interface AvailableUpdate {
	version: string
	notes: string | null
	date: string | null
	packageSize: number | null
	releaseUrl: string | null
}

export interface UpdaterState {
	update: AvailableUpdate | null
	installing: boolean
	progress: number | null
	downloadedBytes: number
	totalBytes: number | null
	phase: UpdateInstallPhase
	error: string | null
	status: UpdateCheckStatus
	automaticChecks: boolean
	checkNow(): Promise<void>
	install(): Promise<void>
	dismiss(): void
	setAutomaticChecks(enabled: boolean): void
}
