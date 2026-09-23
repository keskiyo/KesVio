import { Filter, Pencil, X } from 'lucide-react'
import type { FilterChipProps } from '../types'

const CHIP_BUTTON =
	'grid size-6 place-items-center rounded-md text-(--text-muted) hover:bg-(--surface-raised) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent-strong)'

export function FilterChip({ filter }: FilterChipProps) {
	return (
		<span
			role="group"
			aria-label={`Filter ${filter.name}`}
			className="inline-flex min-w-0 items-center gap-1 rounded-lg border border-(--border-neutral) bg-(--surface-inset) pr-0.5 pl-2 text-xs text-(--text-primary)"
		>
			<Filter size={13} aria-hidden="true" className="shrink-0" />
			<span className="truncate">{filter.name}</span>
			<button
				type="button"
				aria-label={`Edit filter ${filter.name}`}
				onClick={filter.onEdit}
				className={CHIP_BUTTON}
			>
				<Pencil size={12} aria-hidden="true" />
			</button>
			<button
				type="button"
				aria-label="Clear filter"
				onClick={filter.onClear}
				className={CHIP_BUTTON}
			>
				<X size={13} aria-hidden="true" />
			</button>
		</span>
	)
}
