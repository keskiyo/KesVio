import type { RefObject } from 'react'
import type { AppInfo } from '../../../../entities/app'
import type { CategoryDefinition } from '../../../../entities/category'
import type {
	Scenario,
	ScenarioFilter,
	ScenarioList,
	ScenarioSort,
} from '../../../../entities/scenario'
import type { ScenarioRunProgress } from '../../../../features/run-scenario'

export interface ScenariosPageProps {
	scenarios: Scenario[]
	apps: AppInfo[]
	selectableApps: AppInfo[]
	categories: CategoryDefinition[]
	runningId: string | null
	isScenarioRunning: boolean
	runProgress?: ScenarioRunProgress | null
	favoriteScenarioIds: string[]
	onBack(): void
	onCreate(
		name: string,
	): { ok: true; id: string } | { ok: false; error: string }
	onRename(
		id: string,
		name: string,
	): { ok: true } | { ok: false; error: string }
	onDelete(id: string): void
	onAddApp(
		id: string,
		list: ScenarioList,
		identity: string,
	): { ok: true } | { ok: false; error: string }
	onRemoveApp(id: string, list: ScenarioList, identity: string): void
	onRun(scenario: Scenario): void
	onToggleFavorite(id: string): void
}

export interface ScenariosToolbarProps {
	query: string
	filter: ScenarioFilter
	sort: ScenarioSort
	reversed: boolean
	counts: Record<ScenarioFilter, number>
	resultCount: number
	inputRef: RefObject<HTMLInputElement>
	onQueryChange(value: string): void
	onFilterChange(filter: ScenarioFilter): void
	onSortChange(sort: ScenarioSort): void
	onToggleSortDirection(): void
}
