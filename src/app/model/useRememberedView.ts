import { useEffect, useLayoutEffect, useRef } from 'react'
import type { AppView } from '../../entities/app'

const LAST_VIEW_KEY = 'kesvio.last-view'

const REMEMBERED_VIEWS: Record<AppView, true> = {
	all: true,
	favorites: true,
	more: true,
	scenarios: true,
	settings: true,
	catalog_health: true,
	backup_restore: true,
	hidden: true,
	auxiliary: true,
	installers_docs: true,
}

function isAppView(value: string | null): value is AppView {
	return (
		value !== null &&
		Object.prototype.hasOwnProperty.call(REMEMBERED_VIEWS, value)
	)
}

function readLastView(): AppView | null {
	try {
		const stored = globalThis.localStorage?.getItem(LAST_VIEW_KEY) ?? null
		return isAppView(stored) ? stored : null
	} catch {
		return null
	}
}

function rememberView(view: AppView) {
	try {
		globalThis.localStorage?.setItem(LAST_VIEW_KEY, view)
	} catch (ignored) {
		void ignored
	}
}

interface RememberedViewOptions {
	activeView: AppView
	setActiveView(view: AppView): void
}

export function useRememberedView({
	activeView,
	setActiveView,
}: RememberedViewOptions) {
	const restoring = useRef<AppView | null>(null)

	useLayoutEffect(() => {
		const stored = readLastView()
		if (!stored) return
		restoring.current = stored
		setActiveView(stored)
	}, [setActiveView])

	useEffect(() => {
		if (restoring.current && restoring.current !== activeView) return
		restoring.current = null
		rememberView(activeView)
	}, [activeView])
}
