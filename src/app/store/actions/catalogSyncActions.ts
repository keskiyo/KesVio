import {
	mergeIcon,
	reconcileFirstSeen,
	reconcileMarks,
} from '../reconciliation'
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

type CatalogSyncActions = Pick<
	AppState,
	'applyDelta' | 'applyPatches' | 'clearCatalogChange'
>

export function createCatalogSyncActions({
	set,
	get,
	persist,
}: CatalogSyncOptions): CatalogSyncActions {
	return {
		applyDelta(delta) {
			if (delta.generation < get().catalogGeneration) return
			const previousFirstSeen = get().firstSeenAt
			set(state => {
				const removed = new Set(delta.removedIds)
				const apps = new Map(
					state.apps
						.filter(app => !removed.has(app.id))
						.map(app => [app.id, app]),
				)
				for (const app of delta.upserted)
					apps.set(app.id, mergeIcon(apps.get(app.id), app))
				const merged = [...apps.values()]
				return {
					apps: merged,
					catalogGeneration: delta.generation,
					firstSeenAt: reconcileFirstSeen(
						merged,
						state.firstSeenAt,
						Date.now(),
					),
				}
			})
			const marks = reconcileMarks(get(), get().apps)
			if (marks) set(marks)
			if (get().firstSeenAt !== previousFirstSeen || marks) persist()
		},
		applyPatches(patches) {
			const generation = get().catalogGeneration
			const current = patches.filter(
				patch => patch.generation === generation,
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
		clearCatalogChange() {
			set({ catalogChange: null })
		},
	}
}
