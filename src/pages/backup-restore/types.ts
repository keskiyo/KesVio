import type { ChangeEvent, RefObject } from 'react'

export type PreferenceTransferResult =
	{ ok: true } | { ok: false; error: string }

export interface PreferencesBackupActions {
	onExport(): string
	onSaveExport(contents: string): Promise<boolean>
	onValidateImport(source: string): PreferenceTransferResult
	onImport(source: string): PreferenceTransferResult
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
	onCancel(): void
	onConfirm(): void
}

export interface ExportSettingsCardProps {
	exporting: boolean
	onExport(): Promise<void>
}

export interface ImportSettingsCardProps {
	inputRef: RefObject<HTMLInputElement>
	pending: PendingAction
	onSelect(event: ChangeEvent<HTMLInputElement>): Promise<void>
	onCancel(): void
	onConfirm(): void
}

export interface LocalRecoveryCardProps {
	pending: PendingAction
	onRequest(): void
	onCancel(): void
	onConfirm(): void
}
