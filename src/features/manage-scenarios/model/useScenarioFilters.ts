import { useDeferredValue, useMemo, useState } from 'react'
import type { AppInfo } from '../../../entities/app'
import {
	type Scenario,
	type ScenarioFilter,
	type ScenarioSort,
	countScenarioFilters,
	filterScenarios,
	rankScenariosByQuery,
	sortScenarios,
} from '../../../entities/scenario'

interface ScenarioFiltersOptions {
	scenarios: Scenario[]
	apps: AppInfo[]
	favoriteScenarioIds: string[]
}

export function useScenarioFilters({
	scenarios,
	apps,
	favoriteScenarioIds,
}: ScenarioFiltersOptions) {
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState<ScenarioFilter>('all')
	const [sort, setSort] = useState<ScenarioSort>('recent')
	const [reversed, setReversed] = useState(false)
	const deferredQuery = useDeferredValue(query)

	const counts = useMemo(
		() => countScenarioFilters(scenarios, favoriteScenarioIds),
		[favoriteScenarioIds, scenarios],
	)

	const results = useMemo(() => {
		const selected = filterScenarios(scenarios, filter, favoriteScenarioIds)
		const trimmed = deferredQuery.trim()
		const ordered = sortScenarios(selected, sort, reversed)
		if (!trimmed) return ordered
		return rankScenariosByQuery(ordered, apps, trimmed)
	}, [
		apps,
		deferredQuery,
		favoriteScenarioIds,
		filter,
		reversed,
		scenarios,
		sort,
	])

	function reset() {
		setQuery('')
		setFilter('all')
	}

	return {
		query,
		setQuery,
		filter,
		setFilter,
		sort,
		setSort,
		reversed,
		toggleSortDirection: () => setReversed(value => !value),
		counts,
		results,
		isFiltered: query.trim().length > 0 || filter !== 'all',
		reset,
	}
}
