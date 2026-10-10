import { formatBinding } from './format'
import { freeVariant, knownUse } from './knownShortcuts'
import type { CaptureResult } from './types'

const SUPPORTED_KEY = /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'OS'])
const NAVIGATION_KEYS = new Set(['Tab', 'Enter', ' '])

export function readCapture(event: KeyboardEvent): CaptureResult {
	if (event.key === 'Escape') return { kind: 'cancel' }
	if (event.key === 'Backspace') return { kind: 'reset' }
	if (MODIFIER_KEYS.has(event.key)) return { kind: 'hold' }
	if (!SUPPORTED_KEY.test(event.code)) {
		const navigating =
			NAVIGATION_KEYS.has(event.key) &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.metaKey
		return { kind: navigating ? 'pass' : 'invalid' }
	}
	const binding = {
		win: event.metaKey,
		ctrl: event.ctrlKey,
		alt: event.altKey,
		shift: event.shiftKey,
		key: event.code,
	}
	if (!binding.win && !binding.ctrl && !binding.alt)
		return { kind: 'invalid' }
	const label = formatBinding(binding, binding.key)
	const usedInsideKesVio =
		!binding.win &&
		binding.ctrl &&
		!binding.alt &&
		((!binding.shift && binding.key === 'KeyF') || binding.key === 'KeyK')
	if (usedInsideKesVio) return { kind: 'reserved', label }
	const use = knownUse(binding)
	if (use?.kind === 'windows')
		return {
			kind: 'taken',
			owner: 'windows',
			label,
			action: use.action,
			suggestion: freeVariant(binding),
		}
	if (use?.kind === 'standard')
		return {
			kind: 'taken',
			owner: 'standard',
			label,
			action: use.action,
			suggestion: null,
		}
	return { kind: 'binding', binding }
}
