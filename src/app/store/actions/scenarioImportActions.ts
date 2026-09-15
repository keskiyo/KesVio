import {
	MAX_SCENARIO_BACKUP_BYTES,
	mergeScenarioImport,
	reconcileScenarios,
} from '../../../entities/scenario'
import {
	hasNewerStoredPreferences,
	parsePreferenceImport,
} from '../preferences'
import type {
	AppState,
	GetAppState,
	SetAppState,
	RunTransaction,
} from '../types'

interface Options {
	get: GetAppState
	set: SetAppState
	transact: RunTransaction
	storage: Storage
	idFactory: () => string
}

export function createScenarioImportActions({
	get,
	set,
	transact,
	storage,
	idFactory,
}: Options): Pick<
	AppState,
	'inspectScenarioImport' | 'importSelectedScenarios'
> {
	const inspect: AppState['inspectScenarioImport'] = source => {
		if (
			source.length > MAX_SCENARIO_BACKUP_BYTES ||
			new TextEncoder().encode(source).length > MAX_SCENARIO_BACKUP_BYTES
		)
			return { ok: false, error: 'The selected file is too large.' }
		const result = parsePreferenceImport(source)
		return result.ok
			? { ok: true, scenarios: result.preferences.scenarios }
			: result
	}
	return {
		inspectScenarioImport: inspect,
		importSelectedScenarios(source, choices) {
			if (hasNewerStoredPreferences(storage))
				return {
					ok: false,
					error: 'Settings cannot be replaced by this version of KesVio.',
				}
			const parsed = inspect(source)
			if (!parsed.ok) return parsed
			const { scenarios, undoable, preferencesRevision } = get()
			const selected = new Set(choices.map(choice => choice.sourceId))
			const incoming = parsed.scenarios.filter(item =>
				selected.has(item.id),
			)
			const reconciled =
				reconcileScenarios(incoming, get().apps) ?? incoming
			const merged = mergeScenarioImport(
				scenarios,
				reconciled,
				choices,
				idFactory,
			)
			if (!merged.ok) return merged
			transact('Imported scenarios', () =>
				set({ scenarios: merged.scenarios }),
			)
			if (get().preferencesPersisted) return { ok: true }
			set({ scenarios, undoable, preferencesRevision })
			return {
				ok: false,
				error: 'The scenarios could not be saved. Try again.',
			}
		},
	}
}
