import type { AppCategory, CategoryDefinition } from '../../entities/category'
import type { SavedFilter } from '../../entities/app'
import type { Scenario } from '../../entities/scenario'

const LIST_KEYS = [
	'hiddenAppIds',
	'hiddenAppIdentities',
	'favoriteAppIds',
	'favoriteAppIdentities',
	'installerAppIds',
	'installerAppIdentities',
	'documentAppIds',
	'documentAppIdentities',
	'favoriteScenarioIds',
] as const

type ListKey = (typeof LIST_KEYS)[number]

type RecordValue = AppCategory | string[]

export type UndoSnapshot = Record<ListKey, string[]> & {
	categoryOverrides: Record<string, AppCategory>
	categoryOverrideIdentities: Record<string, AppCategory>
	categories: CategoryDefinition[]
	scenarios: Scenario[]
	savedFilters: SavedFilter[]
}

interface ListReversal {
	restore: string[]
	drop: string[]
}

interface EntityReversal<T> {
	id: string
	previous: T | null
}

interface UndoPatch {
	lists: Partial<Record<ListKey, ListReversal>>
	records: {
		categoryOverrides?: Record<string, AppCategory | null>
		categoryOverrideIdentities?: Record<string, AppCategory | null>
	}
	categories: EntityReversal<CategoryDefinition>[]
	scenarios: EntityReversal<Scenario>[]
	savedFilters: EntityReversal<SavedFilter>[]
}

export interface UndoEntry {
	label: string
	revision: number
	patch: UndoPatch
}

export function snapshotForUndo(state: UndoSnapshot): UndoSnapshot {
	return {
		hiddenAppIds: state.hiddenAppIds,
		hiddenAppIdentities: state.hiddenAppIdentities,
		favoriteAppIds: state.favoriteAppIds,
		favoriteAppIdentities: state.favoriteAppIdentities,
		installerAppIds: state.installerAppIds,
		installerAppIdentities: state.installerAppIdentities,
		documentAppIds: state.documentAppIds,
		documentAppIdentities: state.documentAppIdentities,
		favoriteScenarioIds: state.favoriteScenarioIds,
		categoryOverrides: state.categoryOverrides,
		categoryOverrideIdentities: state.categoryOverrideIdentities,
		categories: state.categories,
		scenarios: state.scenarios,
		savedFilters: state.savedFilters,
	}
}

function listReversal(
	before: readonly string[],
	after: readonly string[],
): ListReversal | null {
	const restore = before.filter(item => !after.includes(item))
	const drop = after.filter(item => !before.includes(item))
	return restore.length || drop.length ? { restore, drop } : null
}

function recordReversal<T extends RecordValue>(
	before: Record<string, T>,
	after: Record<string, T>,
): Record<string, T | null> | null {
	const reversal: Record<string, T | null> = {}
	for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
		if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
			reversal[key] = before[key] ?? null
	return Object.keys(reversal).length ? reversal : null
}

function entityReversals<T extends { id: string }>(
	before: readonly T[],
	after: readonly T[],
): EntityReversal<T>[] {
	const previous = new Map(before.map(item => [item.id, item]))
	const current = new Map(after.map(item => [item.id, item]))
	const reversals: EntityReversal<T>[] = []
	for (const id of new Set([...previous.keys(), ...current.keys()])) {
		const was = previous.get(id) ?? null
		const is = current.get(id) ?? null
		if (JSON.stringify(was) !== JSON.stringify(is))
			reversals.push({ id, previous: was })
	}
	return reversals
}

export function undoPatch(
	before: UndoSnapshot,
	after: UndoSnapshot,
): UndoPatch | null {
	const patch: UndoPatch = {
		lists: {},
		records: {},
		categories: entityReversals(before.categories, after.categories),
		scenarios: entityReversals(before.scenarios, after.scenarios),
		savedFilters: entityReversals(before.savedFilters, after.savedFilters),
	}
	for (const key of LIST_KEYS) {
		const reversal = listReversal(before[key], after[key])
		if (reversal) patch.lists[key] = reversal
	}
	const overrides = recordReversal(
		before.categoryOverrides,
		after.categoryOverrides,
	)
	if (overrides) patch.records.categoryOverrides = overrides
	const overrideIdentities = recordReversal(
		before.categoryOverrideIdentities,
		after.categoryOverrideIdentities,
	)
	if (overrideIdentities)
		patch.records.categoryOverrideIdentities = overrideIdentities
	const changed =
		Object.keys(patch.lists).length > 0 ||
		Object.keys(patch.records).length > 0 ||
		patch.categories.length > 0 ||
		patch.scenarios.length > 0 ||
		patch.savedFilters.length > 0
	return changed ? patch : null
}

function reverseList(
	current: readonly string[],
	reversal: ListReversal,
): string[] {
	const kept = current.filter(item => !reversal.drop.includes(item))
	return [...kept, ...reversal.restore.filter(item => !kept.includes(item))]
}

function reverseRecord<T extends RecordValue>(
	current: Record<string, T>,
	reversal: Record<string, T | null>,
): Record<string, T> {
	const next = { ...current }
	for (const [key, previous] of Object.entries(reversal))
		if (previous === null) delete next[key]
		else next[key] = previous
	return next
}

function reverseEntities<T extends { id: string }>(
	current: readonly T[],
	reversals: EntityReversal<T>[],
): T[] {
	let next = [...current]
	for (const { id, previous } of reversals) {
		if (previous === null) next = next.filter(item => item.id !== id)
		else if (next.some(item => item.id === id))
			next = next.map(item => (item.id === id ? previous : item))
		else next.push(previous)
	}
	return next
}

export function applyUndoPatch(
	state: UndoSnapshot,
	patch: UndoPatch,
): Partial<UndoSnapshot> {
	const next: Partial<UndoSnapshot> = {}
	for (const key of LIST_KEYS) {
		const reversal = patch.lists[key]
		if (reversal) next[key] = reverseList(state[key], reversal)
	}
	if (patch.records.categoryOverrides)
		next.categoryOverrides = reverseRecord(
			state.categoryOverrides,
			patch.records.categoryOverrides,
		)
	if (patch.records.categoryOverrideIdentities)
		next.categoryOverrideIdentities = reverseRecord(
			state.categoryOverrideIdentities,
			patch.records.categoryOverrideIdentities,
		)
	if (patch.categories.length)
		next.categories = reverseEntities(state.categories, patch.categories)
	if (patch.scenarios.length)
		next.scenarios = reverseEntities(state.scenarios, patch.scenarios)
	if (patch.savedFilters.length)
		next.savedFilters = reverseEntities(
			state.savedFilters,
			patch.savedFilters,
		)
	return next
}

export function restoredCategoryCollision(
	categories: readonly CategoryDefinition[],
	patch: UndoPatch,
): string | null {
	for (const { id, previous } of patch.categories) {
		if (!previous) continue
		const label = previous.label.toLocaleLowerCase()
		const taken = categories.some(
			category =>
				category.id !== id &&
				category.label.toLocaleLowerCase() === label,
		)
		if (taken) return previous.label
	}
	return null
}
