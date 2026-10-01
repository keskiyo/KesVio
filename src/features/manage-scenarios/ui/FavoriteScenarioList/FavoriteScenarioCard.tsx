import { ChevronRight, LoaderCircle, Play } from 'lucide-react'
import { resolveScenarioApps } from '../../../../entities/scenario'
import { CollapsiblePanel } from '../../../../shared/ui/CollapsiblePanel'
import { FavoriteStar } from '../../../../shared/ui/FavoriteStar'
import { FavoriteScenarioAppList } from './FavoriteScenarioAppList'
import type { FavoriteScenarioCardProps } from './types'

export function FavoriteScenarioCard({
	scenario,
	apps,
	expanded,
	running,
	isScenarioRunning,
	onToggle,
	onRun,
	onToggleFavorite,
}: FavoriteScenarioCardProps) {
	const panelId = `favorite-scenario-${scenario.id}`
	const launch = resolveScenarioApps(
		scenario.launchIdentities,
		apps,
		scenario.launchAppSnapshots,
	)
	const close = resolveScenarioApps(
		scenario.closeIdentities,
		apps,
		scenario.closeAppSnapshots,
	)
	const blocked = isScenarioRunning && !running
	const runLabel = running
		? `${scenario.name} is running`
		: blocked
			? `Run ${scenario.name} unavailable while another scenario is running`
			: `Run ${scenario.name}`

	return (
		<li className="flex min-w-0 flex-col rounded-2xl border border-(--border-neutral) bg-(--surface-raised) shadow-(--shadow-summary)">
			<div className="flex min-w-0 items-center gap-2 p-2">
				<button
					type="button"
					aria-label={runLabel}
					aria-busy={running}
					disabled={isScenarioRunning}
					onClick={() => onRun(scenario.id)}
					className={`grid size-9 shrink-0 place-items-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong) ${blocked ? 'cursor-not-allowed border-(--border-neutral) bg-(--surface-inset) text-(--text-muted)' : 'border-(--accent) bg-(--utility-accent) text-(--text-primary) hover:bg-(--utility-accent-hover) disabled:cursor-progress'}`}
				>
					{running ? (
						<LoaderCircle
							size={16}
							aria-hidden="true"
							className="animate-spin motion-reduce:animate-none"
						/>
					) : (
						<Play size={16} aria-hidden="true" />
					)}
				</button>
				<button
					type="button"
					aria-label={`${scenario.name} ${scenario.launchIdentities.length} launch · ${scenario.closeIdentities.length} close`}
					aria-expanded={expanded}
					aria-controls={panelId}
					onClick={() => onToggle(scenario.id)}
					className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-lg px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
				>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-[0.8125rem] font-medium text-(--text-primary)">
							{scenario.name}
						</span>
						<span className="block truncate text-[0.6875rem] text-(--text-muted)">
							{scenario.launchIdentities.length} launch ·{' '}
							{scenario.closeIdentities.length} close
						</span>
					</span>
					<ChevronRight
						size={14}
						aria-hidden="true"
						className={`shrink-0 text-(--text-muted) transition-transform motion-reduce:transition-none ${expanded ? 'rotate-90' : ''}`}
					/>
				</button>
				<FavoriteStar
					label={`Remove ${scenario.name} from favorites`}
					pressed
					onToggle={() => onToggleFavorite(scenario.id)}
					className="shrink-0"
				/>
			</div>
			<CollapsiblePanel open={expanded} id={panelId}>
				<div className="flex flex-col gap-3 border-t border-(--border-neutral) px-3 py-3">
					<FavoriteScenarioAppList
						label="Launch"
						scenarioName={scenario.name}
						apps={launch.apps}
						unavailable={launch.unavailable}
					/>
					<FavoriteScenarioAppList
						label="Close"
						scenarioName={scenario.name}
						apps={close.apps}
						unavailable={close.unavailable}
					/>
				</div>
			</CollapsiblePanel>
		</li>
	)
}
