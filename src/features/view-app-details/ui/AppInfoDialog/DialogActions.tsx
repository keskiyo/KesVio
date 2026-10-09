import { FileText, HardDrive, Loader2 } from 'lucide-react'
import type { DialogActionsProps } from './types'

const ACTION_CLASS =
	'flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-(--border-neutral) bg-(--surface-raised) px-3 py-2 text-sm font-medium text-(--text-primary) transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_16%,var(--surface-raised))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong) disabled:cursor-progress disabled:opacity-70 sm:w-auto'

export function DialogActions({
	message,
	onCopyReport,
	folder,
}: DialogActionsProps) {
	return (
		<div>
			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				<button
					type="button"
					aria-label="Copy report"
					onClick={() => void onCopyReport()}
					className={ACTION_CLASS}
				>
					<FileText size={18} aria-hidden="true" />
					Copy report
				</button>
				{folder.offered && (
					<button
						type="button"
						aria-label="Measure folder"
						disabled={folder.measuring}
						onClick={() => void folder.onMeasure()}
						className={ACTION_CLASS}
					>
						{folder.measuring ? (
							<Loader2
								size={18}
								className="animate-spin"
								aria-hidden="true"
							/>
						) : (
							<HardDrive size={18} aria-hidden="true" />
						)}
						Measure folder
					</button>
				)}
				{folder.label && (
					<p role="status" className="text-sm text-(--text-muted)">
						{folder.label}
					</p>
				)}
			</div>
			{message && (
				<p role="status" className="mt-2 text-sm text-(--text-muted)">
					{message}
				</p>
			)}
		</div>
	)
}
