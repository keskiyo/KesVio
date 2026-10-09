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
		async launch(app) {
			set({ error: null })
			get().markLaunching(app.id)
			const existing = launchTimers.get(app.id)
			if (existing) clearTimeout(existing)
			launchTimers.set(
				app.id,
				setTimeout(
					() => get().clearLaunching(app.id),
					LAUNCH_CEILING_MS,
				),
			)
			try {
				await client.launchApp({ id: app.id })
			} catch (error) {
				get().clearLaunching(app.id)
				throw error
			}
			recordSuccessfulLaunch(app)
		},
		async launchElevated(app) {
			if (!client.launchAppElevated)
				throw new Error('Elevated launch is unavailable.')
			await client.launchAppElevated({ id: app.id })
			recordSuccessfulLaunch(app)
		},
		async closeApps(ids, allowForce = false) {
			set({ error: null })
			return client.closeApps(ids, allowForce)
		},
	}
}
