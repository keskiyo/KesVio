import type { CategoryDefinition } from '../../entities/category'
import {
	type EntityReversal,
	LIST_KEYS,
	type ListReversal,
	type RecordValue,
	type UndoPatch,
	type UndoSnapshot,
} from './undo'

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
