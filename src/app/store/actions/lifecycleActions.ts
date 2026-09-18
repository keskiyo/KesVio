import type { AppsClient } from '../../../entities/app'
import { newerDiagnostics } from '../catalogGeneration'
import type { AppState, GetAppState, SetAppState } from '../types'

interface LifecycleOptions {
	set: SetAppState
	get: GetAppState
	client: AppsClient
}

export function createLifecycleActions({
	set,
	get,
	client,
}: LifecycleOptions): Pick<AppState, 'initialize'> {
	let initializationPromise: Promise<() => void> | null = null
	let initializationDispose: (() => void) | null = null
	let initializationUsers = 0

	function releaseInitialization() {
		initializationUsers = Math.max(0, initializationUsers - 1)
		if (initializationUsers > 0) return
		initializationDispose?.()
		initializationDispose = null
		initializationPromise = null
	}

	return {
		async initialize() {
			initializationUsers += 1
			if (!initializationPromise) {
				initializationPromise = (async () => {
					const disposers: Array<() => void> = []
					const disposeAll = () => {
						disposers.splice(0).forEach(dispose => {
							try {
								dispose()
							} catch (ignored) {
								void ignored
							}
						})
					}
					const subscribe = async <T>(
						registration:
							| ((
									handler: (value: T) => void,
							  ) => Promise<() => void>)
							| undefined,
						handler: (value: T) => void,
					) => {
						if (registration)
							disposers.push(await registration(handler))
					}
					try {
						await subscribe(client.onCatalogDelta, get().applyDelta)
						await subscribe(
							client.onCatalogPatches,
							get().applyPatches,
						)
						await subscribe(
							client.onCatalogDiagnostics,
							diagnostics =>
								set(state => ({
									catalogDiagnostics: newerDiagnostics(
										state.catalogDiagnostics,
										diagnostics,
									),
								})),
						)
						disposers.push(
							await client.onScanProgress(scanProgress =>
								set({ scanProgress }),
							),
						)
						await subscribe(client.onLaunchStatus, status =>
							get().clearLaunching(status.id),
						)
						await get().load()
						if (get().hasCache) await client.startBackgroundSync?.()
					} catch (error) {
						disposeAll()
						initializationUsers = 0
						initializationDispose = null
						initializationPromise = null
						set({ isLoading: false })
						throw error
					}
					initializationDispose = disposeAll
					return releaseInitialization
				})()
			}
			const release = await initializationPromise
			let released = false
			return () => {
				if (released) return
				released = true
				release()
			}
		},
	}
}
