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
	onOpenFolder(id: string): Promise<void>
	onRefresh(): Promise<void>
	onFullScan(): Promise<void>
	onUndo(): { ok: true } | { ok: false; error: string }
}

async function reportScan(run: () => Promise<void>) {
	try {
		await run()
		toast.success('Application list refreshed')
	} catch (error) {
		const { code } = toAppClientError(error)
		if (code === 'SCAN_CANCELLED') {
			toast.info('Application scan cancelled')
		} else {
			toast.error(`Could not refresh the application list (${code})`)
		}
	}
}

export function useAppFeedback({
	onLaunch,
	onOpenFolder,
	onRefresh,
	onFullScan,
	onUndo,
}: AppFeedbackOptions) {
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

	const openFolder = useCallback(
		async (app: AppInfo) => {
			try {
				await onOpenFolder(app.id)
			} catch {
				toast.error(`Could not open the folder of ${app.name}`)
			}
		},
		[onOpenFolder],
	)

	const refresh = useCallback(() => reportScan(onRefresh), [onRefresh])
	const fullScan = useCallback(() => reportScan(onFullScan), [onFullScan])

	const undo = useCallback(() => {
		const result = onUndo()
		if (result.ok) toast.success('Undone')
		else toast.error(result.error)
	}, [onUndo])

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

	return { launch, openFolder, refresh, fullScan, reportScenarioRun, undo }
}
