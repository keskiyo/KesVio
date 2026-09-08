import type { Scenario } from '../model/scenario.types'
import {
	sortScenariosByName,
	sortScenariosByNewest,
	sortScenariosByRecency,
} from './scenarioOrder'

export type ScenarioFilter = 'all' | 'favorites' | 'recent'

export type ScenarioSort = 'recent' | 'name' | 'newest'

export type ScenarioCounts = Record<ScenarioFilter, number>

export function countScenarioFilters(
	scenarios: readonly Scenario[],
	favoriteIds: readonly string[],
): ScenarioCounts {
	const favorites = new Set(favoriteIds)
	const counts: ScenarioCounts = {
		all: scenarios.length,
		favorites: 0,
		recent: 0,
	}
	for (const scenario of scenarios) {
		if (favorites.has(scenario.id)) counts.favorites += 1
		if ((scenario.lastRunAt ?? 0) > 0) counts.recent += 1
	}
	return counts
}

export function filterScenarios(
	scenarios: readonly Scenario[],
	filter: ScenarioFilter,
	favoriteIds: readonly string[],
): Scenario[] {
	if (filter === 'favorites') {
		const favorites = new Set(favoriteIds)
		return scenarios.filter(scenario => favorites.has(scenario.id))
	}
	if (filter === 'recent')
		return scenarios.filter(scenario => (scenario.lastRunAt ?? 0) > 0)
	return [...scenarios]
}

export function sortScenarios(
	scenarios: readonly Scenario[],
	sort: ScenarioSort,
	reversed = false,
): Scenario[] {
	const ordered =
		sort === 'name'
			? sortScenariosByName(scenarios)
			: sort === 'newest'
				? sortScenariosByNewest(scenarios)
				: sortScenariosByRecency(scenarios)
	return reversed ? ordered.reverse() : ordered
}
