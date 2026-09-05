import { Plus } from 'lucide-react'
import type { ScenarioListRowProps } from '../types'
import { ScenarioTileRow } from './ScenarioTileRow/ScenarioTileRow'

export function ScenarioListRow({
	list,
	label,
	scenarioName,
	apps,
	unavailable,
	disabled,
	markOf,
	onAdd,
	onRemove,
	identityOf,
}: ScenarioListRowProps) {
	return (
		<div className="flex min-w-0 flex-col gap-2 rounded-xl border border-(--border-neutral) bg-(--surface-inset) p-3 sm:flex-row sm:items-start">
			<div className="flex items-center justify-between gap-2 sm:contents">
				<span className="text-xs font-semibold tracking-[.12em] text-(--text-subtle) uppercase sm:w-20 sm:shrink-0 sm:pt-2">
					{label}
				</span>
				<button
					type="button"
					aria-label={`Add an app to the ${label} list of ${scenarioName}`}
					disabled={disabled}
					onClick={() => onAdd(list)}
					className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-lg border border-(--border-neutral) bg-(--surface-panel) px-3 text-xs font-medium text-(--text-primary) transition-colors hover:border-(--accent) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60 sm:order-last"
				>
					<Plus size={14} aria-hidden="true" />
					Add
				</button>
			</div>
			<ScenarioTileRow
				label={label}
				scenarioName={scenarioName}
				apps={apps}
				unavailable={unavailable}
				collapsible
				disabled={disabled}
				markOf={markOf}
				identityOf={identityOf}
				onRemove={identity => onRemove(list, identity)}
				listClassName="flex min-w-0 flex-wrap items-start gap-2"
			/>
		</div>
	)
}
