import { ListChecks, Search, X } from 'lucide-react'
import { ScenarioFilterBar } from '../ScenarioFilterBar/ScenarioFilterBar'
import { DIALOG_LABEL, LIST_ID, SEARCH_LABEL } from './data'
import type { ScenarioLauncherHeaderProps } from './types'

export function ScenarioLauncherHeader({
	query,
	inputRef,
	closeRef,
	filters,
	onQueryChange,
	onClose,
}: ScenarioLauncherHeaderProps) {
	return (
		<div className="border-b border-(--border-neutral)">
			<div className="flex items-center gap-3 px-4 py-3">
				<ListChecks size={18} aria-hidden="true" />
				<h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-(--text-primary)">
					{DIALOG_LABEL}
				</h2>
				<button
					ref={closeRef}
					type="button"
					aria-label="Close all scenarios"
					onClick={onClose}
					className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
				>
					<X size={16} aria-hidden="true" />
				</button>
			</div>
			<div className="flex items-center gap-3 border-t border-(--border-neutral) px-4">
				<Search size={18} aria-hidden="true" />
				<input
					ref={inputRef}
					type="search"
					value={query}
					onChange={event => onQueryChange(event.target.value)}
					placeholder="Search scenarios and their apps…"
					aria-controls={LIST_ID}
					aria-label={SEARCH_LABEL}
					className="h-12 w-full bg-transparent text-sm text-(--text-primary) outline-none placeholder:text-(--text-subtle)"
				/>
			</div>
			<div className="border-t border-(--border-neutral) px-4 py-2.5">
				<ScenarioFilterBar {...filters} />
			</div>
		</div>
	)
}
