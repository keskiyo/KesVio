import {
	MAX_SAVED_FILTER_NAME_LENGTH,
	MAX_SAVED_FILTERS,
	normalizeCriteria,
	type SavedFilter,
} from '../../../entities/app'
import type {
	AppState,
	GetAppState,
	RunTransaction,
	SetAppState,
} from '../types'

interface SavedFilterOptions {
	set: SetAppState
	get: GetAppState
	transact: RunTransaction
	idFactory: () => string
}

type SavedFilterActions = Pick<
	AppState,
	| 'createSavedFilter'
	| 'updateSavedFilter'
	| 'deleteSavedFilter'
	| 'selectSavedFilter'
>

function nameProblem(
	filters: SavedFilter[],
	value: string,
	exceptId?: string,
): string | null {
	if (!value) return 'Enter a filter name'
	if ([...value].length > MAX_SAVED_FILTER_NAME_LENGTH)
		return `A filter name is at most ${MAX_SAVED_FILTER_NAME_LENGTH} characters`
	const taken = filters.some(
		filter =>
			filter.id !== exceptId &&
			filter.name.toLocaleLowerCase() === value.toLocaleLowerCase(),
	)
	return taken ? 'Filter name already exists' : null
}

export function createSavedFilterActions({
	set,
	get,
	transact,
	idFactory,
}: SavedFilterOptions): SavedFilterActions {
	function commit(label: string, change: () => void): boolean {
		const {
			savedFilters,
			activeSavedFilterId,
			undoable,
			preferencesRevision,
		} = get()
		transact(label, change)
		if (get().preferencesPersisted) return true
		set({
			savedFilters,
			activeSavedFilterId,
			undoable,
			preferencesRevision,
		})
		return false
	}
	const failedSave = {
		ok: false as const,
		error: 'The filter could not be saved. Try again.',
	}
	return {
		createSavedFilter(name, criteria) {
			const value = name.trim()
			const problem = nameProblem(get().savedFilters, value)
			if (problem) return { ok: false, error: problem }
			if (get().savedFilters.length >= MAX_SAVED_FILTERS)
				return {
					ok: false,
					error: `At most ${MAX_SAVED_FILTERS} saved filters`,
				}
			const id = `filter:${idFactory().replace(/^custom:/, '')}`
			const saved = commit(`Saved filter ${value}`, () =>
				set(state => ({
					savedFilters: [
						...state.savedFilters,
						{
							id,
							name: value,
							criteria: normalizeCriteria(criteria),
						},
					],
					activeSavedFilterId: id,
				})),
			)
			return saved ? { ok: true, id } : failedSave
		},
		updateSavedFilter(id, name, criteria) {
			const value = name.trim()
			if (!get().savedFilters.some(filter => filter.id === id))
				return { ok: false, error: 'Filter not found' }
			const problem = nameProblem(get().savedFilters, value, id)
			if (problem) return { ok: false, error: problem }
			const saved = commit(`Changed filter ${value}`, () =>
				set(state => ({
					savedFilters: state.savedFilters.map(filter =>
						filter.id === id
							? {
									id,
									name: value,
									criteria: normalizeCriteria(criteria),
								}
							: filter,
					),
				})),
			)
			return saved ? { ok: true } : failedSave
		},
		deleteSavedFilter(id) {
			const filter = get().savedFilters.find(entry => entry.id === id)
			if (!filter) return
			commit(`Deleted filter ${filter.name}`, () =>
				set(state => ({
					savedFilters: state.savedFilters.filter(
						entry => entry.id !== id,
					),
					activeSavedFilterId:
						state.activeSavedFilterId === id
							? null
							: state.activeSavedFilterId,
				})),
			)
		},
		selectSavedFilter(id) {
			set(state => ({
				activeSavedFilterId:
					id && state.savedFilters.some(filter => filter.id === id)
						? id
						: null,
				activeView:
					id &&
					(state.activeView === 'settings' ||
						state.activeView === 'more' ||
						state.activeView === 'scenarios')
						? 'all'
						: state.activeView,
			}))
		},
	}
}
