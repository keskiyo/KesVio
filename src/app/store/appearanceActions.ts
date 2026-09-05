import type { AppState, PersistPreferences, SetAppState } from './types'

interface AppearanceOptions {
	set: SetAppState
	persist: PersistPreferences
}

type AppearanceActions = Pick<AppState, 'setCatalogDensity'>

export function createAppearanceActions({
	set,
	persist,
}: AppearanceOptions): AppearanceActions {
	return {
		setCatalogDensity(density) {
			let changed = false
			set(state => {
				if (state.catalogDensity === density) return state
				changed = true
				return { catalogDensity: density }
			})
			if (changed) persist()
		},
	}
}
