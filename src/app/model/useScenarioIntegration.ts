import type { AppInfo, AppsClient } from '../../entities/app'
import type { SystemClient } from '../../entities/system'
import {
	type ScenarioRunSummary,
	scenarioRunStatus,
	useScenarioRunner,
} from '../../features/run-scenario'
import type { AppState } from '../store/appStore'
import type { ScenarioLauncherControl } from '../types'
import { useTrayScenarios } from './useTrayScenarios'

interface ScenarioIntegrationOptions {
	state: Pick<
		AppState,
		| 'scenarios'
		| 'favoriteScenarioIds'
		| 'launch'
		| 'closeApps'
		| 'markScenarioRun'
		| 'toggleFavoriteScenario'
	>
	catalogApps: AppInfo[]
	appsClient: Pick<AppsClient, 'onCloseProgress'>
	systemClient: Pick<
		SystemClient,
		'setTrayScenarios' | 'setTrayRunning' | 'onTrayScenarioRun'
	>
	onFinished(summary: ScenarioRunSummary): void
}

export function useScenarioIntegration({
	state,
	catalogApps,
	appsClient,
	systemClient,
	onFinished,
}: ScenarioIntegrationOptions) {
	const runner = useScenarioRunner({
		apps: catalogApps,
		scenarios: state.scenarios,
		launch: state.launch,
		closeApps: state.closeApps,
		onCloseProgress: appsClient.onCloseProgress,
		onStarted: state.markScenarioRun,
		onFinished,
	})
	useTrayScenarios({
		systemClient,
		scenarios: state.scenarios,
		favoriteScenarioIds: state.favoriteScenarioIds,
		runningName: runner.runningName,
		onRun: runner.runById,
	})
	const launcher: ScenarioLauncherControl = {
		scenarios: state.scenarios,
		apps: catalogApps,
		favoriteScenarioIds: state.favoriteScenarioIds,
		runningId: runner.runningId,
		isScenarioRunning: runner.isRunning,
		runningStatus: scenarioRunStatus(runner.progress),
		onRun: runner.runById,
		onToggleFavorite: state.toggleFavoriteScenario,
	}
	return { runner, launcher }
}
