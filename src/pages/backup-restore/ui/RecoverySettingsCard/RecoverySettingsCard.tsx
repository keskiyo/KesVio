import { History } from 'lucide-react'
import { PanelHeader } from '../../../../shared/ui/PanelHeader'
import { RECOVERY_SURFACE } from '../../data'
import { ImportRecoveryMethod } from './ImportRecoveryMethod'
import { LocalRecoveryMethod } from './LocalRecoveryMethod'
import type { RecoverySettingsCardProps } from './types'

export function RecoverySettingsCard({
	inputRef,
	pending,
	localBackupAvailable,
	onSelect,
	onRequestRestore,
	onCancel,
	onConfirm,
}: RecoverySettingsCardProps) {
	return (
		<section aria-label="Recover settings" className={RECOVERY_SURFACE}>
			<PanelHeader
				icon={History}
				title="Recover settings"
				description="Replace your current preferences from a file or the local recovery copy."
			/>
			<div className="mt-5 divide-y divide-(--border-neutral)">
				<ImportRecoveryMethod
					inputRef={inputRef}
					pending={pending}
					onSelect={onSelect}
					onCancel={onCancel}
					onConfirm={onConfirm}
				/>
				<LocalRecoveryMethod
					pending={pending}
					localBackupAvailable={localBackupAvailable}
					onRequestRestore={onRequestRestore}
					onCancel={onCancel}
					onConfirm={onConfirm}
				/>
			</div>
		</section>
	)
}
