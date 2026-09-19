import { Filter, Trash2 } from 'lucide-react'
import type { SavedFilter } from '../../../../entities/app'
import { DANGER_ICON_BUTTON } from '../../../../shared/ui/buttonVariants'
import { navigationItemClass } from './data'

interface SavedFilterRowProps {
	filter: SavedFilter
	active: boolean
	onSelect(): void
	onRequestDelete(): void
}

export function SavedFilterRow({
	filter,
	active,
	onSelect,
	onRequestDelete,
}: SavedFilterRowProps) {
	return (
		<li className="flex min-w-0 items-center gap-1.5">
			<button
				type="button"
				aria-label={`${filter.name}${active ? ', applied' : ''}`}
				aria-pressed={active}
				title={filter.name}
				onClick={onSelect}
				className={`${navigationItemClass(active)} min-w-0 flex-1`}
			>
				<Filter className="shrink-0" size={17} aria-hidden="true" />
				<span className="min-w-0 truncate text-left">
					{filter.name}
				</span>
			</button>
			<button
				type="button"
				aria-label={`Delete ${filter.name} filter`}
				title={`Delete ${filter.name} filter`}
				onClick={onRequestDelete}
				className={DANGER_ICON_BUTTON}
			>
				<Trash2 size={15} aria-hidden="true" />
			</button>
		</li>
	)
}
