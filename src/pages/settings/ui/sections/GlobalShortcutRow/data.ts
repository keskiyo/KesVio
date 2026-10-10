import type { GlobalShortcutBinding } from '../../../../../entities/system'
import type { ShortcutModifier } from './types'

export const DEFAULT_BINDING: GlobalShortcutBinding = {
	win: true,
	ctrl: false,
	alt: false,
	shift: true,
	key: 'KeyQ',
}

export const DEFAULT_LABEL = 'Win+Shift+Q'

export const SHORTCUT_MODIFIERS: { key: ShortcutModifier; label: string }[] = [
	{ key: 'win', label: 'Win' },
	{ key: 'ctrl', label: 'Ctrl' },
	{ key: 'alt', label: 'Alt' },
	{ key: 'shift', label: 'Shift' },
]
