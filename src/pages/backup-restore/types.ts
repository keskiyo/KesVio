import type { RefObject } from 'react'

export type PreferenceTransferResult =
	{ ok: true } | { ok: false; error: string }

export interface PreferencesBackupActions {
	onExport(): string
	onSaveExport(contents: string): Promise<boolean>
	onValidateImport(source: string): PreferenceTransferResult
	onImport(source: string): PreferenceTransferResult
	hasLocalBackup(): boolean
	onRestore(): PreferenceTransferResult
}

export interface BackupRestorePageProps extends PreferencesBackupActions {
	onBack(): void
}

export type PendingAction =
	| { kind: 'import'; source: string; name: string }
	| { kind: 'restore' }
	| null

export interface BackupConfirmationProps {
	question: string
	confirmLabel: string
	returnFocusRef: RefObject<HTMLButtonElement>
	onCancel(): void
	onConfirm(): void
}

export interface ExportSettingsCardProps {
	exporting: boolean
	onExport(): Promise<void>
}
