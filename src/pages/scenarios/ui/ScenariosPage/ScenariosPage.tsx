import { ListChecks, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import {
	ScenarioCard,
	ScenarioNameEditor,
	useScenarioFilters,
} from '../../../../features/manage-scenarios'
import { scenarioRunStatus } from '../../../../features/run-scenario'
import { CatalogViewHeader } from '../../../../widgets/catalog-content'
import { ScenariosEmpty } from './ScenariosEmpty'
import { ScenariosToolbar } from './ScenariosToolbar'
import type { ScenariosPageProps } from './types'

export function ScenariosPage({
	scenarios,
	apps,
	selectableApps,
	categories,
	runningId,
	isScenarioRunning,
	runProgress,
	favoriteScenarioIds,
	onBack,
	onCreate,
	onRename,
	onDelete,
	onAddApp,
	onRemoveApp,
	onRun,
	onToggleFavorite,
}: ScenariosPageProps) {
	const [creating, setCreating] = useState(false)
	const searchRef = useRef<HTMLInputElement>(null)
	const filters = useScenarioFilters({ scenarios, apps, favoriteScenarioIds })
	const runningStatus = scenarioRunStatus(runProgress ?? null)

	return (
		<section aria-labelledby="scenarios-title" className="w-full">
			<CatalogViewHeader
				icon={ListChecks}
				title="Scenarios"
				titleId="scenarios-title"
				count={scenarios.length}
				noun="scenario"
				back={{ label: 'Back to More', onBack }}
				action={
					creating ? (
						<ScenarioNameEditor
							label="New scenario name"
							onCancel={() => setCreating(false)}
							onSave={value => {
								const result = onCreate(value)
								if (result.ok) setCreating(false)
								return result.ok ? null : result.error
							}}
						/>
					) : (
						<button
							type="button"
							aria-label="Add scenario"
							onClick={() => setCreating(true)}
							className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-(--border-neutral) bg-(--surface-panel) px-3 text-sm font-medium text-(--text-primary) transition-colors hover:border-(--accent) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
						>
							<Plus size={16} aria-hidden="true" />
							New scenario
						</button>
					)
				}
			/>
			<div className="mx-auto max-w-3xl min-[1900px]:max-w-[80rem]">
				{scenarios.length > 0 && (
					<ScenariosToolbar
						query={filters.query}
						filter={filters.filter}
						sort={filters.sort}
						reversed={filters.reversed}
						counts={filters.counts}
						resultCount={filters.results.length}
						inputRef={searchRef}
						onQueryChange={filters.setQuery}
						onFilterChange={filters.setFilter}
						onSortChange={filters.setSort}
						onToggleSortDirection={filters.toggleSortDirection}
					/>
				)}
				{filters.results.length ? (
					<div className="grid grid-cols-1 items-start gap-3 min-[1900px]:grid-cols-2">
						{filters.results.map(scenario => (
							<ScenarioCard
								key={scenario.id}
								scenario={scenario}
								apps={apps}
								selectableApps={selectableApps}
								categories={categories}
								running={runningId === scenario.id}
								isScenarioRunning={isScenarioRunning}
								runningStatus={
									runningId === scenario.id
										? runningStatus
										: undefined
								}
								isFavorite={favoriteScenarioIds.includes(
									scenario.id,
								)}
								onToggleFavorite={onToggleFavorite}
								onRename={onRename}
								onDelete={onDelete}
								onAddApp={onAddApp}
								onRemoveApp={onRemoveApp}
								onRun={onRun}
							/>
						))}
					</div>
				) : (
					<ScenariosEmpty
						filtered={filters.isFiltered}
						onReset={filters.reset}
					/>
				)}
			</div>
		</section>
	)
}
