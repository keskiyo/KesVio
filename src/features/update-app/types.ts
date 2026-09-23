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
}

export interface UpdaterState {
	update: AvailableUpdate | null
	installing: boolean
	progress: number | null
	phase: UpdateInstallPhase
	error: string | null
	status: UpdateCheckStatus
	automaticChecks: boolean
	checkNow(): Promise<void>
	install(): Promise<void>
	setAutomaticChecks(enabled: boolean): void
}

export interface UpdatePillProps {
	version: string
	phase: UpdateInstallPhase
	progress: number | null
	className?: string
	onInstall(): void
}
