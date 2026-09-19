import { Upload } from 'lucide-react'
import { useRef } from 'react'
import { ACTION_BUTTON_NEUTRAL } from '../../../../shared/ui/buttonVariants'
import { BackupConfirmation } from '../BackupConfirmation'
import type { ImportRecoveryMethodProps } from './types'

export function ImportRecoveryMethod({
	inputRef,
	pending,
	onSelect,
	onCancel,
	onConfirm,
}: ImportRecoveryMethodProps) {
	const triggerRef = useRef<HTMLButtonElement>(null)
	return (
		<section aria-labelledby="file-recovery-title" className="pb-5">
			<div className="flex items-start gap-3">
				<Upload
					size={18}
					aria-hidden="true"
					className="mt-0.5 shrink-0 text-(--accent-strong)"
				/>
				<div className="min-w-0">
					<h3
						id="file-recovery-title"
						className="text-sm font-semibold text-(--text-primary)"
					>
						From a backup file
					</h3>
					<p className="mt-1 text-xs leading-5 text-(--text-muted)">
						Choose a KesVio backup file. It is checked before
						anything changes.
					</p>
				</div>
			</div>
			<div className="mt-4 grid sm:flex sm:justify-end">
				<button
					ref={triggerRef}
					type="button"
					onClick={() => inputRef.current?.click()}
					className={ACTION_BUTTON_NEUTRAL}
				>
					<Upload size={16} aria-hidden="true" />
					Choose backup
				</button>
			</div>
			<input
				ref={inputRef}
				type="file"
				accept="application/json,.json"
				aria-label="Choose settings backup"
				onChange={event => void onSelect(event)}
				className="sr-only"
			/>
			{pending?.kind === 'import' && (
				<BackupConfirmation
					question={`Import ${pending.name}? This replaces your current settings.`}
					confirmLabel="Import backup"
					returnFocusRef={triggerRef}
					onCancel={onCancel}
					onConfirm={onConfirm}
				/>
			)}
		</section>
	)
}
