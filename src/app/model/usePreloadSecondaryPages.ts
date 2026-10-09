import { useEffect } from 'react'
import { preloadSecondaryPages } from '../layout/lazyPages'

const PRELOAD_DELAY_MS = 1500

export function usePreloadSecondaryPages(ready: boolean) {
	useEffect(() => {
		if (!ready) return
		const timer = window.setTimeout(() => {
			void preloadSecondaryPages()
		}, PRELOAD_DELAY_MS)
		return () => window.clearTimeout(timer)
	}, [ready])
}
