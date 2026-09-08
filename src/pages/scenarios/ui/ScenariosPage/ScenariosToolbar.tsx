import { Search } from 'lucide-react'
import {
	LAUNCHER_SHORTCUT,
	ScenarioFilterBar,
} from '../../../../features/manage-scenarios'
import { countLabel } from '../../../../shared/lib/countLabel'
import { ShortcutHint } from '../../../../shared/ui/ShortcutHint'
import type { ScenariosToolbarProps } from './types'

export function ScenariosToolbar({
	query,
	filter,
	sort,
	reversed,
	counts,
	resultCount,
	inputRef,
	onQueryChange,
	onFilterChange,
	onSortChange,
	onToggleSortDirection,
}: ScenariosToolbarProps) {
	return (
		<div className="mb-4 flex flex-col gap-3 rounded-2xl border border-(--border-neutral) bg-(--surface-panel) p-3">
			<div className="flex items-center gap-2 rounded-lg border border-(--border-neutral) bg-(--surface-inset) px-3">
				<Search size={16} aria-hidden="true" />
				<input
					ref={inputRef}
					type="search"
					value={query}
					onChange={event => onQueryChange(event.target.value)}
					placeholder="Search scenarios and their apps…"
					aria-label="Search scenarios"
					className="h-9 w-full bg-transparent text-sm text-(--text-primary) outline-none placeholder:text-(--text-subtle)"
				/>
			</div>
			<ScenarioFilterBar
				filter={filter}
				sort={sort}
				reversed={reversed}
				counts={counts}
				onFilterChange={onFilterChange}
				onSortChange={onSortChange}
				onToggleSortDirection={onToggleSortDirection}
			/>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p aria-live="polite" className="text-xs text-(--text-muted)">
					{countLabel(resultCount, 'scenario')} shown
				</p>
				<ShortcutHint
					label="Open this list from anywhere with"
					keys={LAUNCHER_SHORTCUT}
				/>
			</div>
		</div>
	)
}
