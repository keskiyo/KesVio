import { useEffect } from 'react'
import type { SystemClient } from '../../entities/system'

export function useWindowBackdrop(
	systemClient: Pick<SystemClient, 'getWindowBackdrop'>,
) {
	const { getWindowBackdrop } = systemClient
	useEffect(() => {
		if (!getWindowBackdrop) return
		let active = true
		const root = document.documentElement
		getWindowBackdrop().then(
			backdrop => {
				if (active && backdrop === 'mica')
					root.dataset.backdrop = 'mica'
			},
			() => undefined,
		)
		return () => {
			active = false
			delete root.dataset.backdrop
		}
	}, [getWindowBackdrop])
}
