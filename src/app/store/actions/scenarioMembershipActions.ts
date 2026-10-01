import {
	appIdentity,
	closeBlockedMessage,
	isCloseBlocked,
} from '../../../entities/app'
import {
	MAX_SCENARIO_ENTRIES,
	scenarioAppSnapshot,
	type ScenarioList,
} from '../../../entities/scenario'
import type {
	AppState,
	GetAppState,
	RunTransaction,
	SetAppState,
} from '../types'
import { scenarioNameOf, updateScenario } from './scenarioUpdates'

interface ScenarioMembershipOptions {
	set: SetAppState
	get: GetAppState
	transact: RunTransaction
}

function listKey(list: ScenarioList): 'launchIdentities' | 'closeIdentities' {
	return list === 'launch' ? 'launchIdentities' : 'closeIdentities'
}

function oppositeListKey(
	list: ScenarioList,
): 'launchIdentities' | 'closeIdentities' {
	return list === 'launch' ? 'closeIdentities' : 'launchIdentities'
}

function snapshotKey(
	list: ScenarioList,
): 'launchAppSnapshots' | 'closeAppSnapshots' {
	return list === 'launch' ? 'launchAppSnapshots' : 'closeAppSnapshots'
}

export function createScenarioMembershipActions({
	set,
	get,
	transact,
}: ScenarioMembershipOptions): Pick<
	AppState,
	'addScenarioApp' | 'removeScenarioApp'
> {
	return {
		addScenarioApp(id, list, identity) {
			const key = listKey(list)
			const oppositeKey = oppositeListKey(list)
			const snapshotsKey = snapshotKey(list)
			const app = get().apps.find(
				entry => appIdentity(entry) === identity,
			)
			const scenario = get().scenarios.find(entry => entry.id === id)
			if (!scenario) return { ok: false, error: 'Scenario not found' }
			if (scenario[key].includes(identity))
				return { ok: false, error: 'Already in this list' }
			if (scenario[oppositeKey].includes(identity))
				return {
					ok: false,
					error: 'An app cannot both launch and close',
				}
			if (scenario[key].length >= MAX_SCENARIO_ENTRIES)
				return {
					ok: false,
					error: `A list holds at most ${MAX_SCENARIO_ENTRIES} apps`,
				}
			if (list === 'close') {
				if (app && isCloseBlocked(app))
					return { ok: false, error: closeBlockedMessage(app) }
			}
			transact(`Added ${app?.name ?? 'app'} to ${scenario.name}`, () =>
				updateScenario(set, id, entry => ({
					...entry,
					[key]: [...entry[key], identity],
					...(app
						? {
								[snapshotsKey]: {
									...(entry[snapshotsKey] ?? {}),
									[identity]: scenarioAppSnapshot(app),
								},
							}
						: {}),
				})),
			)
			return { ok: true }
		},
		removeScenarioApp(id, list, identity) {
			const key = listKey(list)
			const snapshotsKey = snapshotKey(list)
			transact(
				`Removed an app from ${scenarioNameOf(get().scenarios, id)}`,
				() =>
					updateScenario(set, id, scenario => ({
						...scenario,
						[key]: scenario[key].filter(
							entry => entry !== identity,
						),
						[snapshotsKey]: Object.fromEntries(
							Object.entries(scenario[snapshotsKey] ?? {}).filter(
								([entry]) => entry !== identity,
							),
						),
					})),
			)
		},
	}
}
