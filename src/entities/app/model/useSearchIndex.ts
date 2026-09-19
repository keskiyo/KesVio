import { useMemo, useSyncExternalStore } from 'react'
import {
	filterAppsByQuery,
	rankAppsByQuery,
	rankAppsByQueryAndCategory,
	rankAppsByQueryTop,
} from '../lib/catalogSearch'
import {
	knownPackageGeneration,
	subscribeKnownPackageIndex,
} from '../lib/search/knownPackageIndex'
import { selectSearchScopeCounts } from './catalogSelectors'

export interface SearchIndex {
	generation: number
	filterAppsByQuery: typeof filterAppsByQuery
	rankAppsByQuery: typeof rankAppsByQuery
	rankAppsByQueryAndCategory: typeof rankAppsByQueryAndCategory
	rankAppsByQueryTop: typeof rankAppsByQueryTop
	selectSearchScopeCounts: typeof selectSearchScopeCounts
}

export function useSearchIndex(): SearchIndex {
	const generation = useSyncExternalStore(
		subscribeKnownPackageIndex,
		knownPackageGeneration,
		knownPackageGeneration,
	)
	return useMemo(
		() => ({
			generation,
			filterAppsByQuery,
			rankAppsByQuery,
			rankAppsByQueryAndCategory,
			rankAppsByQueryTop,
			selectSearchScopeCounts,
		}),
		[generation],
	)
}
