import { useEffect, useRef } from 'react'
import type { AppView } from '../../entities/app'
import type { SystemClient } from '../../entities/system'

interface TraySearchOptions {
	systemClient: Pick<SystemClient, 'onTraySearch' | 'takeTraySearchIntent'>
	isCatalogView: boolean
	onSearch(): void
	selectView(view: AppView): void
}

export function useTraySearch({
	systemClient,
	isCatalogView,
	onSearch,
	selectView,
}: TraySearchOptions) {
	const latest = useRef({ isCatalogView, onSearch, selectView })
	latest.current = { isCatalogView, onSearch, selectView }

	useEffect(() => {
		let active = true
		let stop: (() => void) | undefined
		const search = () => {
			if (!latest.current.isCatalogView) latest.current.selectView('all')
			latest.current.onSearch()
			void systemClient.takeTraySearchIntent?.().catch(() => {})
		}
		void systemClient
			.onTraySearch?.(() => {
				if (active) search()
			})
			.then(unsubscribe => {
				if (active) stop = unsubscribe
				else unsubscribe()
			})
			.catch(() => {})
		void systemClient
			.takeTraySearchIntent?.()
			.then(pending => {
				if (active && pending) search()
			})
			.catch(() => {})
		return () => {
			active = false
			stop?.()
		}
	}, [systemClient])
}
