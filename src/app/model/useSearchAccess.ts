import { useCallback, useRef } from 'react'
import type { AppView } from '../../entities/app'

interface SearchAccessOptions {
	isCatalogView: boolean
	setQuery(query: string): void
	selectView(view: AppView): void
}

export function useSearchAccess({
	isCatalogView,
	setQuery,
	selectView,
}: SearchAccessOptions) {
	const searchInputRef = useRef<HTMLInputElement>(null)
	const focus = useCallback(() => searchInputRef.current?.focus(), [])
	const select = useCallback(() => {
		searchInputRef.current?.focus()
		searchInputRef.current?.select()
	}, [])
	const changeQuery = useCallback(
		(value: string) => {
			setQuery(value)
			if (value.trim() && !isCatalogView) selectView('all')
		},
		[isCatalogView, selectView, setQuery],
	)
	return { searchInputRef, focus, select, changeQuery }
}
