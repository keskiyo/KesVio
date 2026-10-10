import { formatBinding } from './format'
import type { CaptureProblem, ShortcutDescriptionProps } from './types'

const PROMPT =
	'Hold the modifiers and press a key, e.g. Win+Shift+J. Most Win+letter shortcuts belong to Windows and never reach KesVio. Esc cancels.'

function problemText(problem: CaptureProblem) {
	if (problem.kind === 'invalid')
		return 'Add Win, Ctrl or Alt, then press a letter, digit or F1-F12.'
	if (problem.kind === 'reserved')
		return `${problem.label} already works inside KesVio. Choose another shortcut.`
	const next = problem.suggestion
		? `Try ${problem.suggestion}.`
		: 'Choose another shortcut.'
	return problem.owner === 'windows'
		? `Windows keeps ${problem.label} for ${problem.action}. ${next}`
		: `${problem.label} is used for ${problem.action} in every app. ${next}`
}

export function ShortcutDescription({
	recording,
	problem,
	error,
	attempt,
}: ShortcutDescriptionProps) {
	if (recording)
		return (
			<span
				aria-live="polite"
				className={problem ? 'text-(--category-amber)' : undefined}
			>
				{problem ? problemText(problem) : PROMPT}
			</span>
		)
	if (error)
		return (
			<span role="alert" className="text-red-700">
				{attempt
					? `${formatBinding(attempt, attempt.key)}: ${error}`
					: error}
			</span>
		)
	return 'Works from anywhere in Windows.'
}
