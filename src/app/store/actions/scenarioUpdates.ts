import type { Scenario } from '../../../entities/scenario'
import type { SetAppState } from '../types'

export function updateScenario(
	set: SetAppState,
	id: string,
	change: (scenario: Scenario) => Scenario,
) {
	set(state => ({
		scenarios: state.scenarios.map(scenario =>
			scenario.id === id ? change(scenario) : scenario,
		),
	}))
}

export function scenarioNameOf(scenarios: Scenario[], id: string): string {
	return scenarios.find(scenario => scenario.id === id)?.name ?? 'scenario'
}
