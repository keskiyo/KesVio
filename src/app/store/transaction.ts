import { snapshotForUndo, undoPatch } from './undo'
import type {
	GetAppState,
	PersistPreferences,
	RunTransaction,
	SetAppState,
} from './types'

interface TransactionOptions {
	set: SetAppState
	get: GetAppState
	persist: PersistPreferences
}

export function createTransaction({
	set,
	get,
	persist,
}: TransactionOptions): RunTransaction {
	return (label, change) => {
		const before = snapshotForUndo(get())
		change()
		const patch = undoPatch(before, snapshotForUndo(get()))
		if (!patch) return
		set(state => {
			const revision = state.preferencesRevision + 1
			return {
				preferencesRevision: revision,
				undoable: { label, revision, patch },
			}
		})
		persist()
	}
}
