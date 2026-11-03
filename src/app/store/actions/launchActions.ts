import {
	type AppsClient,
	appIdentity,
	recordLaunchStat,
} from '../../../entities/app'
import type {
	AppState,
	GetAppState,
	PersistPreferences,
	SetAppState,
} from '../types'

const LAUNCH_CEILING_MS = 12000

interface LaunchActionOptions {
	set: SetAppState
	get: GetAppState
	client: AppsClient
	persist: PersistPreferences
}

type LaunchActions = Pick<
	AppState,
	| 'markLaunching'
	| 'clearLaunching'
	| 'launch'
	| 'launchElevated'
	| 'closeApps'
>

export function createLaunchActions({
	set,
	get,
	client,
	persist,
}: LaunchActionOptions): LaunchActions {
	const launchTimers = new Map<string, ReturnType<typeof setTimeout>>()
	const pendingLaunches = new Map<
		string,
		{ elevated: boolean; result: Promise<void> }
	>()
	function recordSuccessfulLaunch(app: Parameters<AppState['launch']>[0]) {
		set(state => ({
			appLaunchStats: recordLaunchStat(
				state.appLaunchStats,
				appIdentity(app),
				Date.now(),
			),
		}))
		persist()
	}
	async function launch(
		app: Parameters<AppState['launch']>[0],
		elevated: boolean,
		run: () => Promise<void>,
	) {
		const pending = pendingLaunches.get(app.id)
		if (pending?.elevated === elevated) return pending.result
		if (pending || get().launchingIds.includes(app.id))
			throw new Error('Application is already launching.')
		set({ error: null })
		get().markLaunching(app.id)
		launchTimers.set(
			app.id,
			setTimeout(() => get().clearLaunching(app.id), LAUNCH_CEILING_MS),
		)
		const result = Promise.resolve()
			.then(run)
			.then(() => recordSuccessfulLaunch(app))
			.catch((error: unknown) => {
				get().clearLaunching(app.id)
				throw error
			})
			.finally(() => pendingLaunches.delete(app.id))
		pendingLaunches.set(app.id, { elevated, result })
		return result
	}

	return {
		markLaunching(id) {
			set(state =>
				state.launchingIds.includes(id)
					? state
					: { launchingIds: [...state.launchingIds, id] },
			)
		},
		clearLaunching(id) {
			const timer = launchTimers.get(id)
			if (timer) {
				clearTimeout(timer)
				launchTimers.delete(id)
			}
			set(state =>
				state.launchingIds.includes(id)
					? {
							launchingIds: state.launchingIds.filter(
								appId => appId !== id,
							),
						}
					: state,
			)
		},
		launch(app) {
			return launch(app, false, () => client.launchApp({ id: app.id }))
		},
		async launchElevated(app) {
			if (!client.launchAppElevated)
				throw new Error('Elevated launch is unavailable.')
			const run = client.launchAppElevated
			await launch(app, true, () => run.call(client, { id: app.id }))
		},
		async closeApps(ids, allowForce = false) {
			set({ error: null })
			return client.closeApps(ids, allowForce)
		},
	}
}
