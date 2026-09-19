import { CircleCheck, CircleDashed, History } from 'lucide-react'
import { useRef } from 'react'
import { ACTION_BUTTON_NEUTRAL } from '../../../../shared/ui/buttonVariants'
import { BackupConfirmation } from '../BackupConfirmation'
import type { LocalRecoveryMethodProps } from './types'

export function LocalRecoveryMethod({
	pending,
	localBackupAvailable,
	onRequestRestore,
	onCancel,
	onConfirm,
}: LocalRecoveryMethodProps) {
	const triggerRef = useRef<HTMLButtonElement>(null)
	const StatusIcon = localBackupAvailable ? CircleCheck : CircleDashed
	return (
		<section aria-labelledby="local-recovery-title" className="pt-5">
			<div className="flex flex-wrap items-start gap-3">
				<History
					size={18}
					aria-hidden="true"
					className="mt-0.5 shrink-0 text-(--accent-strong)"
				/>
				<div className="min-w-0 flex-1 basis-52">
					<h3
						id="local-recovery-title"
						className="text-sm font-semibold text-(--text-primary)"
					>
						From local recovery
					</h3>
					<p className="mt-1 text-xs leading-5 text-(--text-muted)">
						{localBackupAvailable
							? 'Restore the previous saved version of your preferences.'
							: 'A recovery copy appears after KesVio replaces previously saved preferences.'}
					</p>
				</div>
				<span
					className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${localBackupAvailable ? 'border-(--category-green)/35 bg-(--category-green)/8 text-(--category-green)' : 'border-(--border-neutral) bg-(--surface-inset) text-(--text-muted)'}`}
				>
					<StatusIcon size={14} aria-hidden="true" />
					{localBackupAvailable ? 'Available' : 'Not available yet'}
				</span>
			</div>
			<div className="mt-4 grid sm:flex sm:justify-end">
				<button
					ref={triggerRef}
					type="button"
					disabled={!localBackupAvailable}
					onClick={onRequestRestore}
					className={ACTION_BUTTON_NEUTRAL}
				>
					<History size={16} aria-hidden="true" />
					Restore local backup
				</button>
			</div>
			{pending?.kind === 'restore' && (
				<BackupConfirmation
					question="Restore the local backup? This replaces your current settings."
					confirmLabel="Restore backup"
					returnFocusRef={triggerRef}
					onCancel={onCancel}
					onConfirm={onConfirm}
				/>
			)}
		</section>
	)
}
