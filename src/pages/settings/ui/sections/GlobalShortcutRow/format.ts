import { SHORTCUT_MODIFIERS } from './data'
import type { ShortcutModifiers } from './types'

export function formatBinding(modifiers: ShortcutModifiers, code?: string) {
	const parts = SHORTCUT_MODIFIERS.filter(({ key }) => modifiers[key]).map(
		({ label }) => label,
	)
	if (code) parts.push(code.replace(/^(Key|Digit)/, ''))
	return parts.join('+')
}
