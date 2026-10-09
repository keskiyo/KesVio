import { useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { toAppClientError } from '../../shared/api/tauri/errors'
import { copyToClipboard } from '../../shared/lib/clipboard'
import type { AppInfo } from '../../entities/app'
import type { AppFileActions } from '../../features/app-actions'
import {
	scenarioRunSummaryMessage,
	type ScenarioRunSummary,
} from '../../features/run-scenario'

interface AppFeedbackOptions {
	onLaunch(app: AppInfo): Promise<void>
	onOpenFolder(id: string): Promise<void>
	onLaunchElevated?(app: AppInfo): Promise<void>
	onCanLaunchElevated?(app: AppInfo): Promise<boolean>
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
	onLaunchElevated,
	onCanLaunchElevated,
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

	const copyPath = useCallback(async (app: AppInfo) => {
		try {
			await copyToClipboard(app.path)
			toast.success('Path copied')
		} catch {
			toast.error('Could not copy the path')
		}
	}, [])

	const launchElevated = useCallback(
		async (app: AppInfo) => {
			if (!onLaunchElevated) return
			try {
				await onLaunchElevated(app)
				toast.success(`${app.name} launched as administrator`)
			} catch (error) {
				if (toAppClientError(error).code === 'LAUNCH_CANCELLED')
					toast.info('Launch cancelled')
				else
					toast.error(`Could not launch ${app.name} as administrator`)
			}
		},
		[onLaunchElevated],
	)

	const elevationAnswers = useRef(new Map<string, Promise<boolean>>())
	const canLaunchElevated = useCallback(
		(app: AppInfo) => {
			if (!onCanLaunchElevated) return Promise.resolve(false)
			const known = elevationAnswers.current.get(app.id)
			if (known) return known
			const answer = onCanLaunchElevated(app).catch(() => {
				elevationAnswers.current.delete(app.id)
				return false
			})
			elevationAnswers.current.set(app.id, answer)
			return answer
		},
		[onCanLaunchElevated],
	)

	const fileActions = useMemo<AppFileActions>(
		() => ({
			openFolder,
			copyPath,
			launchElevated: onLaunchElevated ? launchElevated : undefined,
			canLaunchElevated: onCanLaunchElevated
				? canLaunchElevated
				: undefined,
		}),
		[
			openFolder,
			copyPath,
			launchElevated,
			onLaunchElevated,
			canLaunchElevated,
			onCanLaunchElevated,
		],
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

	return {
		launch,
		openFolder,
		fileActions,
		refresh,
		fullScan,
		reportScenarioRun,
		undo,
	}
}
