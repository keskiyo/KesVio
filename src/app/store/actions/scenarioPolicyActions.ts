import type {
	AppState,
	GetAppState,
	SetAppState,
	RunTransaction,
} from '../types'

export function createScenarioPolicyActions({
	get,
	set,
	transact,
}: {
	get: GetAppState
	set: SetAppState
	transact: RunTransaction
}): Pick<AppState, 'setScenarioForceClose'> {
	return {
		setScenarioForceClose(id, forceClose) {
			const { scenarios, undoable, preferencesRevision } = get()
			const scenario = scenarios.find(item => item.id === id)
			if (!scenario) return false
			if ((scenario.forceClose ?? true) === forceClose) return true
			transact(`Changed close policy for ${scenario.name}`, () =>
				set({
					scenarios: scenarios.map(item =>
						item.id === id ? { ...item, forceClose } : item,
					),
				}),
			)
			if (get().preferencesPersisted) return true
			set({ scenarios, undoable, preferencesRevision })
			return false
		},
	}
}
