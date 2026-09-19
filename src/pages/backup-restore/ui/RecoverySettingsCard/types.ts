import type { ChangeEvent, RefObject } from 'react'
import type { PendingAction } from '../../types'

export interface RecoverySettingsCardProps {
	inputRef: RefObject<HTMLInputElement>
	pending: PendingAction
	localBackupAvailable: boolean
	onSelect(event: ChangeEvent<HTMLInputElement>): Promise<void>
	onRequestRestore(): void
	onCancel(): void
	onConfirm(): void
}

export type ImportRecoveryMethodProps = Pick<
	RecoverySettingsCardProps,
	'inputRef' | 'pending' | 'onSelect' | 'onCancel' | 'onConfirm'
>

export type LocalRecoveryMethodProps = Pick<
	RecoverySettingsCardProps,
	| 'pending'
	| 'localBackupAvailable'
	| 'onRequestRestore'
	| 'onCancel'
	| 'onConfirm'
>
