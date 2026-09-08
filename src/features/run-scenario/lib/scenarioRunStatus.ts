import type { ScenarioRunProgress } from '../types'

export function scenarioRunStatus(
	progress: ScenarioRunProgress | null,
): string | undefined {
	if (!progress) return undefined
	const phase = progress.phase === 'launching' ? 'Launching' : 'Closing'
	return [`${phase} ${progress.completed}/${progress.total}`, progress.detail]
		.filter(Boolean)
		.join(' · ')
}
