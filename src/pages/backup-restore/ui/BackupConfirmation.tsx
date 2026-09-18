import type { BackupConfirmationProps } from '../types'

export function BackupConfirmation({
	question,
	confirmLabel,
	onCancel,
	onConfirm,
}: BackupConfirmationProps) {
	return (
		<div className="mt-4 flex flex-col gap-3 rounded-xl border border-violet-400/35 bg-violet-500/8 p-4 sm:flex-row sm:items-center">
			<p className="min-w-0 text-sm leading-6 text-slate-700 sm:flex-1">
				{question}
			</p>
			<div className="flex gap-3 sm:shrink-0">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-violet-500"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className="utility-accent-button rounded-lg px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-violet-500"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	)
}
