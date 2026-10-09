import { useMemo } from 'react'
import {
	type CategorizedAppsState,
	createMarkLookup,
	selectCategorizedApps,
} from '../../../entities/app'

interface CategorizedCatalogState extends CategorizedAppsState {
	favoriteAppIds: string[]
	favoriteAppIdentities: string[]
	hiddenAppIds: string[]
	hiddenAppIdentities: string[]
}

export function useCategorizedCatalog(state: CategorizedCatalogState) {
	const categorizedApps = useMemo(
		() =>
			selectCategorizedApps({
				apps: state.apps,
				categoryOverrides: state.categoryOverrides,
				categoryOverrideIdentities: state.categoryOverrideIdentities,
				promotedAppIds: state.promotedAppIds,
				promotedAppIdentities: state.promotedAppIdentities,
				installerAppIds: state.installerAppIds,
				installerAppIdentities: state.installerAppIdentities,
				documentAppIds: state.documentAppIds,
				documentAppIdentities: state.documentAppIdentities,
			}),
		[
			state.apps,
			state.categoryOverrides,
			state.categoryOverrideIdentities,
			state.promotedAppIds,
			state.promotedAppIdentities,
			state.installerAppIds,
			state.installerAppIdentities,
			state.documentAppIds,
			state.documentAppIdentities,
		],
	)
	const isHidden = useMemo(
		() => createMarkLookup(state.hiddenAppIds, state.hiddenAppIdentities),
		[state.hiddenAppIds, state.hiddenAppIdentities],
	)
	const isFavorite = useMemo(
		() =>
			createMarkLookup(state.favoriteAppIds, state.favoriteAppIdentities),
		[state.favoriteAppIds, state.favoriteAppIdentities],
	)
	return { categorizedApps, isHidden, isFavorite }
}
