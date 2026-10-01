import { useEffect } from 'react'
import { QUICK_LAUNCH_SHORTCUT_OWNER } from '../../features/command-palette'
import { SCENARIO_LAUNCHER_SHORTCUT_OWNER } from '../../features/manage-scenarios'
import { topmostModal } from '../../shared/lib/modalLayering'
import { isTypingTarget } from '../../shared/lib/typingTarget'

interface GlobalShortcuts {
	onToggleQuickLaunch: () => void
	onToggleScenarios: () => void
	onSearchFromShortcut: () => void
	onFocusSearch: () => void
	onUndo?: () => void
}

export function useGlobalShortcuts({
	onToggleQuickLaunch,
	onToggleScenarios,
	onSearchFromShortcut,
	onFocusSearch,
	onUndo,
}: GlobalShortcuts) {
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const typing = isTypingTarget(event.target)
			const modal = topmostModal()
			const behindModal = (owner?: string) =>
				modal !== null &&
				(owner === undefined || modal.dataset.shortcut !== owner)
			const commandOrControl = event.ctrlKey || event.metaKey
			const isUndoShortcut =
				commandOrControl &&
				!event.shiftKey &&
				!event.altKey &&
				(event.code === 'KeyZ' || event.key.toLowerCase() === 'z')
			if (isUndoShortcut) {
				if (typing || !onUndo || behindModal()) return
				event.preventDefault()
				event.stopPropagation()
				onUndo()
				return
			}
			const pressedK =
				event.code === 'KeyK' || event.key.toLowerCase() === 'k'
			const isScenarioShortcut =
				commandOrControl && event.shiftKey && pressedK
			const isQuickLaunchShortcut =
				commandOrControl && !event.shiftKey && pressedK
			const isSearchShortcut =
				commandOrControl &&
				(event.code === 'KeyF' || event.key.toLowerCase() === 'f')
			const isPrintShortcut =
				commandOrControl &&
				(event.code === 'KeyP' || event.key.toLowerCase() === 'p')
			if (isPrintShortcut) {
				event.preventDefault()
				event.stopPropagation()
				return
			}
			if (isScenarioShortcut) {
				event.preventDefault()
				event.stopPropagation()
				if (!behindModal(SCENARIO_LAUNCHER_SHORTCUT_OWNER))
					onToggleScenarios()
				return
			}
			if (isQuickLaunchShortcut) {
				event.preventDefault()
				event.stopPropagation()
				if (!behindModal(QUICK_LAUNCH_SHORTCUT_OWNER))
					onToggleQuickLaunch()
				return
			}
			if (isSearchShortcut) {
				event.preventDefault()
				event.stopPropagation()
				if (!behindModal()) onSearchFromShortcut()
				return
			}
			if (event.key === '/' && !typing && !behindModal()) {
				event.preventDefault()
				onFocusSearch()
			}
		}
		document.addEventListener('keydown', onKeyDown, { capture: true })
		return () =>
			document.removeEventListener('keydown', onKeyDown, {
				capture: true,
			})
	}, [
		onToggleQuickLaunch,
		onToggleScenarios,
		onSearchFromShortcut,
		onFocusSearch,
		onUndo,
	])
}
