import { useState } from 'react'
import { sortScenariosByNewest } from '../../../../entities/scenario'
import { SectionHeading } from '../../../../shared/ui/SectionHeading'
import { ShortcutHint } from '../../../../shared/ui/ShortcutHint'
import { LAUNCHER_SHORTCUT } from '../ScenarioRunDialog/data'
import { FavoriteScenarioCard } from './FavoriteScenarioCard'
import type { FavoriteScenarioListProps } from './types'

export function FavoriteScenarioList({
	scenarios,
	apps,
	runningId,
	isScenarioRunning,
	onRun,
	onToggleFavorite,
}: FavoriteScenarioListProps) {
	const [expanded, setExpanded] = useState<string[]>([])

	if (!scenarios.length) return null

	function toggle(id: string) {
		setExpanded(open =>
			open.includes(id)
				? open.filter(entry => entry !== id)
				: [...open, id],
		)
	}

	return (
		<section
			aria-labelledby="favorite-scenarios-title"
			className="mb-6 sm:max-w-[61rem]"
		>
			<SectionHeading
				title="Scenarios"
				titleId="favorite-scenarios-title"
				aside={
					<ShortcutHint
						label="Run from anywhere with"
						keys={LAUNCHER_SHORTCUT}
					/>
				}
			/>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] items-start gap-2 sm:grid-cols-[repeat(auto-fill,minmax(18rem,20rem))]">
				{sortScenariosByNewest(scenarios).map(scenario => (
					<FavoriteScenarioCard
						key={scenario.id}
						scenario={scenario}
						apps={apps}
						expanded={expanded.includes(scenario.id)}
						running={runningId === scenario.id}
						isScenarioRunning={isScenarioRunning}
						onToggle={toggle}
						onRun={onRun}
						onToggleFavorite={onToggleFavorite}
					/>
				))}
			</ul>
		</section>
	)
}
