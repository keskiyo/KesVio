import type {
	ScenarioFilter,
	ScenarioSort,
} from '../../../../entities/scenario'

export interface ScenarioFilterBarProps {
	filter: ScenarioFilter
	sort: ScenarioSort
	reversed: boolean
	counts: Record<ScenarioFilter, number>
	onFilterChange(filter: ScenarioFilter): void
	onSortChange(sort: ScenarioSort): void
	onToggleSortDirection(): void
}
