import { toAppClientError } from '../../shared/api/tauri/errors'
import { mergeIcon, reconcileFirstSeen, reconcileMarks } from './reconciliation'
import type { AppsClient, CatalogScanResult } from '../../entities/app'
import type {
	AppState,
	GetAppState,
	PersistPreferences,
	SetAppState,
} from './types'

interface CatalogActionOptions {
	set: SetAppState
	get: GetAppState
	client: AppsClient
	persist: PersistPreferences
}

function errorMessage(error: unknown): string | null {
	const clientError = toAppClientError(error)
	return clientError.code === 'SCAN_CANCELLED' ? null : clientError.message
}

type CatalogActions = Pick<
	AppState,
	| 'load'
	| 'refresh'
	| 'forceFullScan'
	| 'resetCatalogCache'
	| 'cancelScan'
	| 'setQuery'
	| 'setActiveView'
>

export function createCatalogActions({
	set,
	get,
	client,
	persist,
}: CatalogActionOptions): CatalogActions {
	function commitScan(scan: CatalogScanResult) {
		const previousFirstSeen = get().firstSeenAt
		const previous = new Map(get().apps.map(app => [app.id, app]))
		const apps = scan.apps.map(app => mergeIcon(previous.get(app.id), app))
		const firstSeenAt = reconcileFirstSeen(
			apps,
			previousFirstSeen,
			Date.now(),
		)
		const marks = reconcileMarks(get(), apps)
		set({
			apps,
			hasCache: true,
			catalogGeneration: scan.generation,
			firstSeenAt,
			...marks,
		})
		if (firstSeenAt !== previousFirstSeen || marks) persist()
	}

	return {
		async load() {
			set({ isLoading: true, error: null })
			try {
				const snapshot = await client.getApps()
				set({
					apps: snapshot.apps,
					firstSeenAt: reconcileFirstSeen(
						snapshot.apps,
						get().firstSeenAt,
						Date.now(),
					),
					hasCache: snapshot.hasCache,
					catalogGeneration: snapshot.generation ?? 0,
					catalogDiagnostics: snapshot.diagnostics ?? null,
					...reconcileMarks(get(), snapshot.apps),
				})
				persist()
			} catch (error) {
				set({ error: errorMessage(error) })
			} finally {
				set({ isLoading: false })
			}
		},
		async refresh() {
			set({ isRefreshing: true, error: null })
			try {
				commitScan(await client.refreshApps())
			} finally {
				set({ isRefreshing: false, scanProgress: null })
			}
		},
		async forceFullScan() {
			set({ isRefreshing: true, error: null })
			try {
				commitScan(
					client.forceFullScan
						? await client.forceFullScan()
						: await client.refreshApps(),
				)
			} finally {
				set({ isRefreshing: false, scanProgress: null })
			}
		},
		async resetCatalogCache() {
			if (!client.resetCatalogCache) {
				await get().forceFullScan()
				return
			}
			set({ isRefreshing: true, error: null })
			try {
				commitScan(await client.resetCatalogCache())
			} finally {
				set({ isRefreshing: false, scanProgress: null })
			}
		},
		async cancelScan() {
			await client.cancelScan()
		},
		setQuery(query) {
			set({ query })
		},
		setActiveView(activeView) {
			set({ activeView })
		},
	}
}
