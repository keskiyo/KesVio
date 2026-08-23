import { ScenarioTileRow } from '../ScenarioTileRow/ScenarioTileRow'
import type { ScenarioRunListProps } from './types'

export function ScenarioRunList({
	label,
	scenarioName,
	apps,
	unavailable,
	collapsible,
}: ScenarioRunListProps) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<span className="text-xs font-semibold tracking-[.12em] text-(--text-subtle) uppercase">
				{label}
			</span>
			{apps.length === 0 && unavailable.length === 0 ? (
				<p className="text-xs text-(--text-muted)">Nothing here yet.</p>
			) : (
				<ScenarioTileRow
					label={label}
					scenarioName={scenarioName}
					apps={apps}
					unavailable={unavailable}
					collapsible={collapsible}
					listClassName="flex min-w-0 flex-wrap items-start gap-2"
				/>
			)}
		</div>
	)
}
