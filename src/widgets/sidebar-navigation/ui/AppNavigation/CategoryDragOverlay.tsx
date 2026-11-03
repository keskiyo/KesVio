import {
	categoryAccent,
	navigationCategoryCountClass,
	navigationCategoryRowClass,
} from '../SortableNavigationCategory/data'
import type { CategoryDragOverlayProps } from '../../types'

export function CategoryDragOverlay({
	category,
	count,
	label,
	accent: customAccent,
	disconnected = false,
}: CategoryDragOverlayProps) {
	return (
		<div
			aria-hidden="true"
			data-testid="category-drag-overlay"
			data-category-accent={
				disconnected ? 'slate' : categoryAccent(category, customAccent)
			}
			className={`${navigationCategoryRowClass} pointer-events-none shadow-(--shadow-menu)`}
		>
			<span
				className={`block min-w-0 flex-1 truncate ${disconnected ? 'text-(--text-muted)' : ''}`}
			>
				{label}
			</span>
			{disconnected && (
				<span className="mx-2 shrink-0 text-[11px] text-(--text-muted)">
					Disconnected
				</span>
			)}
			<span className={navigationCategoryCountClass}>{count}</span>
		</div>
	)
}
