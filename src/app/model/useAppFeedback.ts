import { useCallback } from 'react'
import { toast } from 'sonner'
import { toAppClientError } from '../../shared/api/tauri/errors'
import type { AppInfo } from '../../entities/app'
import {
	scenarioRunSummaryMessage,
	type ScenarioRunSummary,
} from '../../features/run-scenario'

interface AppFeedbackOptions {
	onLaunch(app: AppInfo): Promise<void>
	onRefresh(): Promise<void>
}

export function useAppFeedback({ onLaunch, onRefresh }: AppFeedbackOptions) {
	const launch = useCallback(
		async function launch(app: AppInfo) {
			try {
				await onLaunch(app)
				toast.success(`${app.name} launched`)
			} catch {
				toast.error(`Could not launch ${app.name}`, {
					action: {
						label: 'Retry',
						onClick: () => void launch(app),
					},
				})
			}
		},
		[onLaunch],
	)

	const refresh = useCallback(async () => {
		try {
			await onRefresh()
			toast.success('Application list refreshed')
		} catch (error) {
			const { code } = toAppClientError(error)
			if (code === 'SCAN_CANCELLED') {
				toast.info('Application scan cancelled')
			} else {
				toast.error(`Could not refresh the application list (${code})`)
			}
		}
	}, [onRefresh])

	const reportScenarioRun = useCallback((summary: ScenarioRunSummary) => {
		const message = scenarioRunSummaryMessage(summary)
		if (!message) return
		const failed =
			summary.launchFailed ||
			summary.closeFailed ||
			summary.blocked ||
			summary.closeUnavailable
		if (failed) toast.warning(message)
		else toast.success(message)
	}, [])

	return { launch, refresh, reportScenarioRun }
}
