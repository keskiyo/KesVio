import { applyUndoPatch, restoredCategoryCollision } from '../undo'
import type {
	AppState,
	GetAppState,
	PersistPreferences,
	SetAppState,
} from '../types'

interface UndoActionOptions {
	set: SetAppState
	get: GetAppState
	persist: PersistPreferences
}

export function createUndoActions({
	set,
	get,
	persist,
}: UndoActionOptions): Pick<AppState, 'undo'> {
	return {
		undo() {
			const entry = get().undoable
			if (!entry) return { ok: false, error: 'Nothing to undo' }
			if (entry.revision !== get().preferencesRevision) {
				set({ undoable: null })
				return {
					ok: false,
					error: 'Settings changed since that action; nothing was undone',
				}
			}
			const collision = restoredCategoryCollision(
				get().categories,
				entry.patch,
			)
			if (collision)
				return {
					ok: false,
					error: `A category named ${collision} already exists`,
				}
			set(state => ({
				...applyUndoPatch(state, entry.patch),
				undoable: null,
				preferencesRevision: state.preferencesRevision + 1,
			}))
			persist()
			return get().preferencesPersisted
				? { ok: true }
				: {
						ok: false,
						error: 'Undone for this session, but the change could not be saved',
					}
		},
	}
}
