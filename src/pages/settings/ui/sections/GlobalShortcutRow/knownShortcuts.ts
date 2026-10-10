import type { GlobalShortcutBinding } from '../../../../../entities/system'
import { formatBinding } from './format'
import type { KnownUse } from './types'

const WINDOWS_ACTIONS: Record<string, string> = {
	'Win+A': 'opening Quick Settings',
	'Win+B': 'focusing the taskbar corner icons',
	'Win+C': 'opening Copilot',
	'Win+D': 'showing or hiding the desktop',
	'Win+E': 'opening File Explorer',
	'Win+F': 'opening Feedback Hub',
	'Win+G': 'opening Xbox Game Bar',
	'Win+H': 'starting voice typing',
	'Win+I': 'opening Settings',
	'Win+J': 'focusing a Windows tip',
	'Win+K': 'opening Cast',
	'Win+L': 'locking the PC',
	'Win+M': 'minimizing all windows',
	'Win+N': 'opening the notification center',
	'Win+O': 'locking screen orientation',
	'Win+P': 'switching projection mode',
	'Win+Q': 'opening Search',
	'Win+R': 'opening Run',
	'Win+S': 'opening Search',
	'Win+T': 'cycling through taskbar apps',
	'Win+U': 'opening Accessibility settings',
	'Win+V': 'opening clipboard history',
	'Win+W': 'opening Widgets',
	'Win+X': 'opening the Quick Link menu',
	'Win+Y': 'switching input between Mixed Reality and the desktop',
	'Win+Z': 'opening snap layouts',
	'Win+Shift+M': 'restoring minimized windows',
	'Win+Shift+S': 'taking a Snipping Tool screenshot',
	'Win+Ctrl+C': 'toggling color filters',
	'Win+Ctrl+D': 'adding a virtual desktop',
	'Win+Ctrl+F': 'searching for PCs on a network',
	'Win+Ctrl+F4': 'closing the virtual desktop',
	'Win+Ctrl+N': 'opening Narrator settings',
	'Win+Ctrl+O': 'opening the On-Screen Keyboard',
	'Win+Ctrl+Q': 'opening Quick Assist',
	'Win+Ctrl+S': 'starting Windows Speech Recognition',
	'Win+Alt+B': 'turning HDR on or off',
	'Win+Alt+D': 'showing the date and time on the taskbar',
	'Win+Alt+G': 'recording the last moments of a game',
	'Win+Alt+K': 'muting the microphone in Game Bar',
	'Win+Alt+R': 'starting or stopping game recording',
}

const APP_ACTIONS: Record<string, string> = {
	'Ctrl+A': 'selecting all',
	'Ctrl+B': 'making text bold',
	'Ctrl+C': 'copying',
	'Ctrl+E': 'focusing the search box',
	'Ctrl+H': 'opening history or replace',
	'Ctrl+I': 'making text italic',
	'Ctrl+L': 'focusing the address bar',
	'Ctrl+N': 'opening a new window or document',
	'Ctrl+O': 'opening files',
	'Ctrl+P': 'printing',
	'Ctrl+R': 'refreshing',
	'Ctrl+S': 'saving',
	'Ctrl+T': 'opening a new tab',
	'Ctrl+U': 'underlining text',
	'Ctrl+V': 'pasting',
	'Ctrl+W': 'closing the tab',
	'Ctrl+X': 'cutting',
	'Ctrl+Y': 'redoing',
	'Ctrl+Z': 'undoing',
	'Ctrl+F4': 'closing the document or tab',
	'Ctrl+F5': 'hard refreshing',
	'Ctrl+Shift+N': 'creating a new folder or private window',
	'Ctrl+Shift+T': 'reopening a closed tab',
	'Ctrl+Shift+V': 'pasting without formatting',
	'Alt+F4': 'closing windows',
}

const TASKBAR_ACTIONS: Record<string, string> = {
	Win: 'opening the taskbar app pinned in position',
	'Win+Shift': 'opening a new window of the taskbar app in position',
	'Win+Ctrl': 'switching to the last window of the taskbar app in position',
	'Win+Alt': 'opening the jump list of the taskbar app in position',
	'Win+Ctrl+Shift': 'opening as administrator the taskbar app in position',
}

export function knownUse(binding: GlobalShortcutBinding): KnownUse | null {
	const label = formatBinding(binding, binding.key)
	const windowsAction = WINDOWS_ACTIONS[label]
	if (windowsAction) return { kind: 'windows', action: windowsAction }
	const appAction = APP_ACTIONS[label]
	if (appAction) return { kind: 'standard', action: appAction }
	const digit = /^Digit(\d)$/.exec(binding.key)?.[1]
	const taskbarAction = digit && TASKBAR_ACTIONS[formatBinding(binding)]
	if (digit && taskbarAction)
		return {
			kind: 'windows',
			action: `${taskbarAction} ${digit === '0' ? '10' : digit}`,
		}
	if (label === `Ctrl+${digit}`)
		return {
			kind: 'risky',
			effect: `will stop ${digit === '0' ? 'resetting zoom' : 'switching browser tabs'} in other apps`,
		}
	const letter = /^Key[A-Z]$/.test(binding.key)
	if (letter && label === `Ctrl+Alt+${binding.key.slice(3)}`)
		return { kind: 'risky', effect: 'will stop typing its AltGr character' }
	if (letter && label === `Alt+${binding.key.slice(3)}`)
		return {
			kind: 'risky',
			effect: 'will stop opening menus in other apps',
		}
	return null
}

export function freeVariant(binding: GlobalShortcutBinding) {
	const variants = [
		{ ...binding, shift: true },
		{ ...binding, alt: true },
	].filter(
		variant =>
			variant.shift !== binding.shift || variant.alt !== binding.alt,
	)
	const free = variants.find(variant => !knownUse(variant))
	return free ? formatBinding(free, free.key) : null
}
