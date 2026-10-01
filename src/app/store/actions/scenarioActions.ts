import { MAX_SCENARIOS, type Scenario } from '../../../entities/scenario'
import type {
	AppState,
	GetAppState,
	PersistPreferences,
	RunTransaction,
	SetAppState,
} from '../types'
import { scenarioNameOf, updateScenario } from './scenarioUpdates'

interface ScenarioActionOptions {
	set: SetAppState
	get: GetAppState
	persist: PersistPreferences
	transact: RunTransaction
	idFactory: () => string
}

type ScenarioActions = Pick<
	AppState,
	| 'createScenario'
	| 'renameScenario'
	| 'deleteScenario'
	| 'toggleFavoriteScenario'
	| 'markScenarioRun'
>

function nameTaken(
	scenarios: Scenario[],
	value: string,
	exceptId?: string,
): boolean {
	return scenarios.some(
		scenario =>
			scenario.id !== exceptId &&
			scenario.name.toLocaleLowerCase() === value.toLocaleLowerCase(),
	)
}

export function createScenarioActions({
	set,
	get,
	persist,
	transact,
	idFactory,
}: ScenarioActionOptions): ScenarioActions {
	return {
		createScenario(name) {
			const value = name.trim()
			if (!value) return { ok: false, error: 'Enter a scenario name' }
			if (nameTaken(get().scenarios, value))
				return { ok: false, error: 'Scenario name already exists' }
			if (get().scenarios.length >= MAX_SCENARIOS)
				return { ok: false, error: 'Too many scenarios' }
			const id = idFactory()
			transact(`Created scenario ${value}`, () =>
				set(state => ({
					scenarios: [
						...state.scenarios,
						{
							id,
							name: value,
							forceClose: false,
							launchIdentities: [],
							closeIdentities: [],
							launchAppSnapshots: {},
							closeAppSnapshots: {},
							createdAt: Date.now(),
							lastRunAt: null,
						},
					],
				})),
			)
			return { ok: true, id }
		},
		renameScenario(id, name) {
			const value = name.trim()
			if (!value) return { ok: false, error: 'Enter a scenario name' }
			if (nameTaken(get().scenarios, value, id))
				return { ok: false, error: 'Scenario name already exists' }
			if (!get().scenarios.some(scenario => scenario.id === id))
				return { ok: false, error: 'Scenario not found' }
			transact(`Renamed scenario to ${value}`, () =>
				updateScenario(set, id, scenario => ({
					...scenario,
					name: value,
				})),
			)
			return { ok: true }
		},
		deleteScenario(id) {
			transact(
				`Deleted scenario ${scenarioNameOf(get().scenarios, id)}`,
				() =>
					set(state => ({
						scenarios: state.scenarios.filter(
							scenario => scenario.id !== id,
						),
						favoriteScenarioIds: state.favoriteScenarioIds.filter(
							entry => entry !== id,
						),
					})),
			)
		},
		markScenarioRun(id) {
			if (!get().scenarios.some(scenario => scenario.id === id)) return
			updateScenario(set, id, scenario => ({
				...scenario,
				lastRunAt: Date.now(),
			}))
			persist()
		},
		toggleFavoriteScenario(id) {
			if (!get().scenarios.some(scenario => scenario.id === id)) return
			set(state => ({
				favoriteScenarioIds: state.favoriteScenarioIds.includes(id)
					? state.favoriteScenarioIds.filter(entry => entry !== id)
					: [...state.favoriteScenarioIds, id],
			}))
			persist()
		},
	}
}
