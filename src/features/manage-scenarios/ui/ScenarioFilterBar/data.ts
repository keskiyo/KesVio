import type {
	ScenarioFilter,
	ScenarioSort,
} from '../../../../entities/scenario'

export const FILTER_OPTIONS: { value: ScenarioFilter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'favorites', label: 'Favorites' },
	{ value: 'recent', label: 'Recent' },
]

export const SORT_OPTIONS: { value: ScenarioSort; label: string }[] = [
	{ value: 'recent', label: 'Last run' },
	{ value: 'name', label: 'Name' },
	{ value: 'newest', label: 'Newest' },
]
