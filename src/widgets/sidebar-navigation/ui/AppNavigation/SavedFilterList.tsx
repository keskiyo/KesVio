import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog'
import { SavedFilterRow } from './SavedFilterRow'
import type { SavedFilterListProps } from './types'

const COLLAPSED_FILTER_LIMIT = 6

export function SavedFilterList({
	filters,
	activeId,
	onSelect,
	onCreate,
	onDelete,
}: SavedFilterListProps) {
	const [deletingId, setDeletingId] = useState<string | null>(null)
	const [expanded, setExpanded] = useState(false)
	const deletingFilter = filters.find(filter => filter.id === deletingId)
	const visibleFilters = expanded
		? filters
		: filters.slice(0, COLLAPSED_FILTER_LIMIT)
	const canExpand = filters.length > COLLAPSED_FILTER_LIMIT

	return (
		<>
			<div className="mt-4 mb-2 flex items-center justify-between px-1">
				<p className="text-[.68rem] font-semibold tracking-[.16em] text-(--text-subtle) uppercase">
					Saved filters
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
					{visibleFilters.map(filter => (
						<SavedFilterRow
							key={filter.id}
							filter={filter}
							active={filter.id === activeId}
							onSelect={() =>
								onSelect(
									filter.id === activeId ? null : filter.id,
								)
							}
							onRequestDelete={() => setDeletingId(filter.id)}
						/>
					))}
				</ul>
			)}
			{canExpand && (
				<button
					type="button"
					onClick={() => setExpanded(value => !value)}
					className="mt-1 inline-flex min-h-9 w-full items-center justify-center rounded-lg px-3 text-xs font-medium text-(--text-muted) hover:bg-(--surface-raised) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
				>
					{expanded
						? 'Show fewer saved filters'
						: `Show all ${filters.length} saved filters`}
				</button>
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
