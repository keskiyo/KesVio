import { isCatalogArtifact } from '../../../entities/app'
import { addUnique, identityOf } from '../reconciliation'
import type {
	AppState,
	GetAppState,
	PersistPreferences,
	RunTransaction,
	SetAppState,
} from '../types'

interface AppMarkOptions {
	set: SetAppState
	get: GetAppState
	persist: PersistPreferences
	transact: RunTransaction
}

function appName(state: AppState, id: string): string {
	return state.apps.find(item => item.id === id)?.name ?? 'app'
}

type AppMarkActions = Pick<
	AppState,
	| 'toggleFavorite'
	| 'hideApp'
	| 'restoreApp'
	| 'promoteAuxiliary'
	| 'demoteAuxiliary'
>

export function createAppMarkActions({
	set,
	get,
	persist,
	transact,
}: AppMarkOptions): AppMarkActions {
	return {
		toggleFavorite(id) {
			set(state => {
				const app = state.apps.find(item => item.id === id)
				if (app && isCatalogArtifact(app)) return state
				const promoted = app
					? state.promotedAppIds.includes(app.id) ||
						state.promotedAppIdentities.includes(identityOf(app))
					: false
				if (app?.visibilityClass === 'auxiliary' && !promoted)
					return state
				const identity = app ? identityOf(app) : id
				const wasFavorite = state.favoriteAppIds.includes(id)
				return {
					favoriteAppIds: wasFavorite
						? state.favoriteAppIds.filter(appId => appId !== id)
						: [...state.favoriteAppIds, id],
					favoriteAppIdentities: wasFavorite
						? state.favoriteAppIdentities.filter(
								item => item !== identity,
							)
						: addUnique(state.favoriteAppIdentities, identity),
				}
			})
			persist()
		},
		hideApp(id) {
			transact(`Hid ${appName(get(), id)}`, () =>
				set(state => {
					if (state.hiddenAppIds.includes(id)) return state
					const app = state.apps.find(item => item.id === id)
					const identity = app ? identityOf(app) : id
					return {
						hiddenAppIds: [...state.hiddenAppIds, id],
						hiddenAppIdentities: addUnique(
							state.hiddenAppIdentities,
							identity,
						),
					}
				}),
			)
		},
		restoreApp(id) {
			transact(`Restored ${appName(get(), id)}`, () =>
				set(state => {
					const app = state.apps.find(item => item.id === id)
					const identity = app ? identityOf(app) : id
					return {
						hiddenAppIds: state.hiddenAppIds.filter(
							appId => appId !== id,
						),
						hiddenAppIdentities: state.hiddenAppIdentities.filter(
							item => item !== identity,
						),
					}
				}),
			)
		},
		promoteAuxiliary(id) {
			const app = get().apps.find(item => item.id === id)
			const identity = app ? identityOf(app) : id
			set(state => ({
				promotedAppIdentities: state.promotedAppIdentities.includes(
					identity,
				)
					? state.promotedAppIdentities
					: [...state.promotedAppIdentities, identity],
			}))
			persist()
		},
		demoteAuxiliary(id) {
			const app = get().apps.find(item => item.id === id)
			const identity = app ? identityOf(app) : id
			set(state => ({
				promotedAppIds: state.promotedAppIds.filter(
					appId => appId !== id,
				),
				promotedAppIdentities: state.promotedAppIdentities.filter(
					item => item !== identity,
				),
				favoriteAppIds: state.favoriteAppIds.filter(
					appId => appId !== id,
				),
				favoriteAppIdentities: state.favoriteAppIdentities.filter(
					item => item !== identity,
				),
			}))
			persist()
		},
	}
}
