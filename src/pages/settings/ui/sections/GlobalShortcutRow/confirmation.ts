import type { GlobalShortcutBinding } from '../../../../../entities/system'
import { formatBinding } from './format'
import { knownUse } from './knownShortcuts'
import type { ChangeRow } from './types'

export function describeChange(
	candidate: GlobalShortcutBinding,
	current: string,
) {
	const keys = formatBinding(candidate, candidate.key)
	const use = knownUse(candidate)
	const outcomes: ChangeRow[] = [
		{ tone: 'gain', keys, text: 'will open KesVio from anywhere' },
		{ tone: 'freed', keys: current, text: 'will stop opening KesVio' },
	]
	const loss: ChangeRow | null =
		use?.kind === 'risky' ? { tone: 'loss', keys, text: use.effect } : null
	return {
		keys,
		risky: loss !== null,
		rows: loss ? [loss, ...outcomes] : outcomes,
		note: `If another app already uses ${keys}, saving fails and ${current} stays.`,
	}
}
