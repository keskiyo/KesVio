import { Filter, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DANGER_ICON_BUTTON } from '../../../../shared/ui/buttonVariants'
import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog'
import { NavItem } from './NavItem'
import type { SavedFilterListProps } from './types'

export function SavedFilterList({
	filters,
	activeId,
	onSelect,
	onCreate,
	onDelete,
}: SavedFilterListProps) {
	const [deletingId, setDeletingId] = useState<string | null>(null)
	const deletingFilter = filters.find(filter => filter.id === deletingId)

	return (
		<>
			<div className="mt-4 mb-2 flex items-center justify-between px-1">
				<p className="text-[.68rem] font-semibold tracking-[.16em] text-(--text-subtle) uppercase">
					Filters
				</p>
				<button
					type="button"
					aria-label="New filter"
					onClick={onCreate}
					className="grid size-7 place-items-center rounded-lg border border-(--border-neutral) bg-(--surface-raised) text-(--text-muted) transition-colors hover:bg-(--utility-accent) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
				>
					<Plus size={16} aria-hidden="true" />
				</button>
			</div>
			{filters.length === 0 ? (
				<p className="px-1 text-xs text-(--text-muted)">
					Save a set of criteria to come back to it here.
				</p>
			) : (
				<ul className="space-y-1" aria-label="Saved filters">
					{filters.map(filter => (
						<li key={filter.id} className="group relative">
							<NavItem
								icon={Filter}
								label={filter.name}
								active={filter.id === activeId}
								className="pr-12"
								onClick={() =>
									onSelect(
										filter.id === activeId
											? null
											: filter.id,
									)
								}
							/>
							<button
								type="button"
								aria-label={`Delete ${filter.name} filter`}
								title={`Delete ${filter.name} filter`}
								onClick={event => {
									event.stopPropagation()
									setDeletingId(filter.id)
								}}
								className={`absolute top-1/2 right-1.5 -translate-y-1/2 bg-(--surface-panel) opacity-100 transition-opacity motion-reduce:transition-none lg:pointer-events-none lg:opacity-0 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 ${DANGER_ICON_BUTTON}`}
							>
								<Trash2 size={15} aria-hidden="true" />
							</button>
						</li>
					))}
				</ul>
			)}
			{deletingFilter && (
				<ConfirmDialog
					label={`Delete ${deletingFilter.name} filter`}
					title={`Delete ${deletingFilter.name}?`}
					description="This saved filter will be removed. You can undo this action."
					confirmLabel="Delete filter"
					closeLabel="Close filter deletion"
					onClose={() => setDeletingId(null)}
					onConfirm={() => {
						onDelete(deletingFilter.id)
						setDeletingId(null)
					}}
				/>
			)}
		</>
	)
}
