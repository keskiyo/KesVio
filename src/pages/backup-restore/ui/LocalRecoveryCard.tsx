import { History } from 'lucide-react'
import { ACTION_BUTTON_NEUTRAL } from '../../../shared/ui/buttonVariants'
import { PanelHeader } from '../../../shared/ui/PanelHeader'
import { RECOVERY_SURFACE } from '../data'
import type { LocalRecoveryCardProps } from '../types'
import { BackupConfirmation } from './BackupConfirmation'

export function LocalRecoveryCard({
	pending,
	onRequest,
	onCancel,
	onConfirm,
}: LocalRecoveryCardProps) {
	return (
		<section aria-label="Local recovery" className={RECOVERY_SURFACE}>
			<div className="flex flex-wrap items-center gap-4">
				<div className="min-w-0 flex-1 basis-64">
					<PanelHeader
						icon={History}
						title="Local recovery"
						description="KesVio keeps the previous copy of your preferences and refreshes it each time they are saved. Restoring brings that copy back in place of the current one."
					/>
				</div>
				<button
					type="button"
					onClick={onRequest}
					className={`${ACTION_BUTTON_NEUTRAL} w-full sm:w-auto`}
				>
					<History size={16} aria-hidden="true" />
					Restore local backup
				</button>
			</div>
			{pending?.kind === 'restore' && (
				<BackupConfirmation
					question="Restore the local backup? This replaces your current settings."
					confirmLabel="Restore backup"
					onCancel={onCancel}
					onConfirm={onConfirm}
				/>
			)}
		</section>
	)
}
