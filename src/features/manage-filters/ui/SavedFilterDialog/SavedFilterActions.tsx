import { Trash2 } from 'lucide-react'
import { DANGER_VARIANT } from '../../../../shared/ui/buttonVariants'

interface SavedFilterActionsProps {
	editing: boolean
	onDelete?: () => void
	onClose(): void
}

export function SavedFilterActions({
	editing,
	onDelete,
	onClose,
}: SavedFilterActionsProps) {
	return (
		<div className="mt-3 flex shrink-0 items-center justify-end gap-2 border-t border-(--border-neutral) pt-3">
			{onDelete && (
				<button
					type="button"
					aria-label="Delete filter"
					title="Delete filter"
					onClick={onDelete}
					className={`mr-auto inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${DANGER_VARIANT}`}
				>
					<Trash2 size={15} aria-hidden="true" />
					Delete
				</button>
			)}
			<button
				type="button"
				onClick={onClose}
				className="inline-flex h-9 items-center rounded-lg border border-(--border-neutral) bg-(--surface-panel) px-3 text-sm font-medium text-(--text-primary) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong) min-[420px]:px-4"
			>
				Cancel
			</button>
			<button
				type="submit"
				className="utility-accent-button inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 min-[420px]:px-4"
			>
				{editing ? 'Save filter' : 'Create filter'}
			</button>
		</div>
	)
}
