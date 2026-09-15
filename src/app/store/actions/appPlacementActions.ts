import {
	INSTALLERS_DOCS_CATEGORY,
	isCatalogArtifact,
} from '../../../entities/app'
import { addUnique, identityOf } from '../reconciliation'
import { driveCategoryFor } from '../../../entities/category'
import type {
	AppState,
	GetAppState,
	RunTransaction,
	SetAppState,
} from '../types'

interface AppPlacementOptions {
	set: SetAppState
	get: GetAppState
	transact: RunTransaction
}

function moveLabel(state: AppState, id: string, category: string): string {
	const name = state.apps.find(item => item.id === id)?.name ?? 'app'
	const target =
		state.categories.find(entry => entry.id === category)?.label ?? category
	return `Moved ${name} to ${target}`
}

export function createAppPlacementActions({
	set,
	get,
	transact,
}: AppPlacementOptions): Pick<AppState, 'moveApp'> {
	return {
		moveApp(id, category, artifact = 'installer') {
			if (driveCategoryFor(get().apps.find(app => app.id === id))) return
			transact(moveLabel(get(), id, category), () =>
				set(state => {
					const app = state.apps.find(item => item.id === id)
					if (app && isCatalogArtifact(app)) return state
					const identity = app ? identityOf(app) : id
					const withoutInstaller = {
						installerAppIds: state.installerAppIds.filter(
							appId => appId !== id,
						),
						installerAppIdentities:
							state.installerAppIdentities.filter(
								item => item !== identity,
							),
					}
					const withoutDocument = {
						documentAppIds: state.documentAppIds.filter(
							appId => appId !== id,
						),
						documentAppIdentities:
							state.documentAppIdentities.filter(
								item => item !== identity,
							),
					}
					if (category === INSTALLERS_DOCS_CATEGORY)
						return {
							...withoutInstaller,
							...withoutDocument,
							...(artifact === 'documentation'
								? {
										documentAppIds: addUnique(
											withoutDocument.documentAppIds,
											id,
										),
										documentAppIdentities: addUnique(
											withoutDocument.documentAppIdentities,
											identity,
										),
									}
								: {
										installerAppIds: addUnique(
											withoutInstaller.installerAppIds,
											id,
										),
										installerAppIdentities: addUnique(
											withoutInstaller.installerAppIdentities,
											identity,
										),
									}),
							favoriteAppIds: state.favoriteAppIds.filter(
								appId => appId !== id,
							),
							favoriteAppIdentities:
								state.favoriteAppIdentities.filter(
									item => item !== identity,
								),
						}
					return {
						...withoutInstaller,
						...withoutDocument,
						categoryOverrides: {
							...state.categoryOverrides,
							[id]: category,
						},
						categoryOverrideIdentities: {
							...state.categoryOverrideIdentities,
							[identity]: category,
						},
					}
				}),
			)
		},
	}
}
