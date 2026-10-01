import { toAppClientError } from '../../../shared/api/tauri/errors'
import { reconcileScenarios } from '../../../entities/scenario'
import { reconcileDriveCategories } from '../driveCategories'
import { identityRekeys } from '../identityRekey'
import {
	catalogGenerationOrder,
	keepHeldRecords,
	newerDiagnostics,
} from '../catalogGeneration'
import {
	pruneFirstSeen,
	reconcileFirstSeen,
	rekeyFirstSeen,
} from '../firstSeen'
import { reconcileMarks } from '../reconciliation'
import type { AppsClient, CatalogScanResult } from '../../../entities/app'
import type {
	AppState,
	GetAppState,
	PersistPreferences,
	SetAppState,
} from '../types'

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
	let scansInFlight = 0

	function beginScan() {
		scansInFlight += 1
		set({ isRefreshing: true, error: null })
	}

	function endScan() {
		scansInFlight = Math.max(0, scansInFlight - 1)
		if (scansInFlight === 0)
			set({ isRefreshing: false, scanProgress: null })
	}

	async function runScan(scan: () => Promise<CatalogScanResult>) {
		beginScan()
		try {
			commitScan(await scan())
		} finally {
			endScan()
		}
	}

	function adoptCatalog(apps: AppState['apps']) {
		const state = get()
		const rekeys = identityRekeys(state.apps, apps)
		const firstSeen = reconcileFirstSeen(
			apps,
			rekeyFirstSeen(
				{
					firstSeenAt: state.firstSeenAt,
					firstSeenVolumes: state.firstSeenVolumes,
				},
				rekeys,
			),
			Date.now(),
		)
		const marks = reconcileMarks(state, apps)
		const scenarios = reconcileScenarios(state.scenarios, apps)
		const drives = reconcileDriveCategories(
			marks ? { ...state, ...marks } : state,
			apps,
		)
		return {
			patch: {
				apps,
				...firstSeen,
				...marks,
				...(scenarios ? { scenarios } : {}),
				...(drives ?? {}),
			},
			changed:
				firstSeen.firstSeenAt !== state.firstSeenAt ||
				firstSeen.firstSeenVolumes !== state.firstSeenVolumes ||
				Boolean(marks || scenarios || drives),
		}
	}

	function commitScan(scan: CatalogScanResult) {
		const order = catalogGenerationOrder(
			scan.generation,
			get().catalogGeneration,
		)
		if (order === 'stale') return
		const apps = keepHeldRecords(get().apps, scan.apps, order)
		const adopted = adoptCatalog(apps)
		const firstSeen = pruneFirstSeen(apps, {
			firstSeenAt: adopted.patch.firstSeenAt,
			firstSeenVolumes: adopted.patch.firstSeenVolumes,
		})
		set({
			...adopted.patch,
			...firstSeen,
			hasCache: true,
			catalogGeneration: scan.generation,
		})
		if (
			adopted.changed ||
			firstSeen.firstSeenAt !== adopted.patch.firstSeenAt
		)
			persist()
	}

	return {
		async load() {
			set({ isLoading: true, error: null })
			try {
				const snapshot = await client.getApps()
				const order = catalogGenerationOrder(
					snapshot.generation,
					get().catalogGeneration,
				)
				if (order === 'stale') return
				const apps =
					order === 'same'
						? keepHeldRecords(get().apps, snapshot.apps, order)
						: snapshot.apps
				const adopted = adoptCatalog(apps)
				set({
					...adopted.patch,
					hasCache: snapshot.hasCache,
					catalogGeneration: snapshot.generation ?? 0,
					catalogDiagnostics: newerDiagnostics(
						get().catalogDiagnostics,
						snapshot.diagnostics,
					),
				})
				persist()
			} catch (error) {
				set({ error: errorMessage(error) })
			} finally {
				set({ isLoading: false })
			}
		},
		refresh: () => runScan(() => client.refreshApps()),
		forceFullScan: () =>
			runScan(() =>
				client.forceFullScan
					? client.forceFullScan()
					: client.refreshApps(),
			),
		async resetCatalogCache() {
			const reset = client.resetCatalogCache
			if (!reset) {
				await get().forceFullScan()
				return
			}
			await runScan(() => reset())
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
