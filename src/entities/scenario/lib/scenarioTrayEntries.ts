import type { Scenario } from '../model/scenario.types'
import { sortScenariosByNewest, sortScenariosByRecency } from './scenarioOrder'

export const MAX_TRAY_SCENARIOS = 5

export interface TrayScenarioEntry {
	id: string
	label: string
	favorite: boolean
}

export function pickTrayScenarios(
	scenarios: readonly Scenario[],
	favoriteIds: readonly string[],
	limit = MAX_TRAY_SCENARIOS,
): TrayScenarioEntry[] {
	if (limit <= 0) return []
	const favorites = new Set(favoriteIds)
	const eligible = scenarios.filter(scenario => favorites.has(scenario.id))
	const ranked = sortScenariosByRecency(
		eligible.filter(scenario => (scenario.lastRunAt ?? 0) > 0),
	)
	const byNewest = sortScenariosByNewest(eligible)
	const picked: Scenario[] = []
	const taken = new Set<string>()
	for (const group of [ranked, byNewest]) {
		for (const scenario of group) {
			if (picked.length >= limit) break
			if (taken.has(scenario.id)) continue
			taken.add(scenario.id)
			picked.push(scenario)
		}
	}
	return picked.map(scenario => ({
		id: scenario.id,
		label: scenario.name,
		favorite: true,
	}))
}
