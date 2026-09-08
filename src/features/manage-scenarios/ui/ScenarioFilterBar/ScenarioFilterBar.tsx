import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import type { ScenarioSort } from '../../../../entities/scenario'
import { FILTER_OPTIONS, SORT_OPTIONS } from './data'
import type { ScenarioFilterBarProps } from './types'

export function ScenarioFilterBar({
	filter,
	sort,
	reversed,
	counts,
	onFilterChange,
	onSortChange,
	onToggleSortDirection,
}: ScenarioFilterBarProps) {
	const DirectionIcon = reversed ? ArrowUpNarrowWide : ArrowDownWideNarrow
	const sortLabel =
		SORT_OPTIONS.find(option => option.value === sort)?.label ?? ''

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div
				role="group"
				aria-label="Filter scenarios"
				className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
			>
				{FILTER_OPTIONS.map(option => {
					const active = filter === option.value
					const count = counts[option.value]
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={active}
							disabled={count === 0 && option.value !== 'all'}
							onClick={() => onFilterChange(option.value)}
							className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-(--accent) bg-(--utility-accent) text-(--text-primary)' : 'border-(--border-neutral) bg-(--surface-panel) text-(--text-muted) hover:bg-(--surface-raised)'}`}
						>
							{option.label}
							<span className="text-[0.6875rem] tabular-nums opacity-70">
								{count}
							</span>
						</button>
					)
				})}
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<label className="inline-flex items-center gap-1.5 text-xs text-(--text-muted)">
					<span className="sr-only">Sort scenarios</span>
					<select
						value={sort}
						onChange={event =>
							onSortChange(event.target.value as ScenarioSort)
						}
						className="h-7 rounded-lg border border-(--border-neutral) bg-(--surface-panel) px-2 text-xs text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
					>
						{SORT_OPTIONS.map(option => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<button
					type="button"
					aria-pressed={reversed}
					aria-label={
						reversed
							? `${sortLabel}: reversed order, press to restore the default order`
							: `${sortLabel}: default order, press to reverse it`
					}
					onClick={onToggleSortDirection}
					className="grid size-7 shrink-0 place-items-center rounded-lg border border-(--border-neutral) bg-(--surface-panel) text-(--text-muted) transition-colors hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
				>
					<DirectionIcon size={14} aria-hidden="true" />
				</button>
			</div>
		</div>
	)
}
