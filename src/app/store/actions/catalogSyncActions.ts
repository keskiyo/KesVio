import { reconcileDriveCategories } from '../driveCategories'
import { identityRekeys, rekeyRecord } from '../identityRekey'
import { catalogGenerationOrder, mergeIcon } from '../catalogGeneration'
import { reconcileFirstSeen, reconcileMarks } from '../reconciliation'
import type {
	AppState,
	GetAppState,
	PersistPreferences,
	SetAppState,
} from '../types'

interface CatalogSyncOptions {
	set: SetAppState
	get: GetAppState
	persist: PersistPreferences
}

type CatalogSyncActions = Pick<AppState, 'applyDelta' | 'applyPatches'>

export function createCatalogSyncActions({
	set,
	get,
	persist,
}: CatalogSyncOptions): CatalogSyncActions {
	return {
		applyDelta(delta) {
			if (
				catalogGenerationOrder(
					delta.generation,
					get().catalogGeneration,
				) === 'stale'
			)
				return
			const state = get()
			const removed = new Set(delta.removedIds)
			const apps = new Map(
				state.apps
					.filter(app => !removed.has(app.id))
					.map(app => [app.id, app]),
			)
			for (const app of delta.upserted)
				apps.set(app.id, mergeIcon(apps.get(app.id), app))
			const merged = [...apps.values()]
			const rekeys = identityRekeys(state.apps, merged)
			const firstSeenAt = reconcileFirstSeen(
				merged,
				rekeyRecord(state.firstSeenAt, rekeys),
				Date.now(),
			)
			set({
				apps: merged,
				catalogGeneration: delta.generation,
				firstSeenAt,
			})
			const marks = reconcileMarks(get(), get().apps)
			if (marks) set(marks)
			const drives = reconcileDriveCategories(get(), get().apps)
			if (drives) set(drives)
			if (firstSeenAt !== state.firstSeenAt || marks || drives) persist()
		},
		applyPatches(patches) {
			const generation = get().catalogGeneration
			const current = patches.filter(
				patch =>
					catalogGenerationOrder(patch.generation, generation) ===
					'same',
			)
			if (!current.length) return
			const byId = new Map(current.map(patch => [patch.id, patch]))
			set(state => ({
				apps: state.apps.map(app => {
					const patch = byId.get(app.id)
					if (!patch) return app
					const {
						id: _id,
						generation: _generation,
						...fields
					} = patch
					return { ...app, ...fields }
				}),
			}))
		},
	}
}
