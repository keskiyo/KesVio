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

export interface SearchIndex {
	generation: number
	filterAppsByQuery: typeof filterAppsByQuery
	rankAppsByQuery: typeof rankAppsByQuery
	rankAppsByQueryAndCategory: typeof rankAppsByQueryAndCategory
	rankAppsByQueryTop: typeof rankAppsByQueryTop
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
		}),
		[generation],
	)
}
