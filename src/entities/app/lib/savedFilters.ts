import type { AppInfo, AppSourceKind } from '../model/app.types'

export const MAX_SAVED_FILTERS = 20
export const MAX_SAVED_FILTER_NAME_LENGTH = 64
const MAX_ADDED_WITHIN_DAYS = 365
const MAX_UNUSED_FOR_DAYS = 3650

export const SAVED_FILTER_SOURCES: readonly AppSourceKind[] = [
	'registry',
	'start_menu',
	'start_apps',
	'msix',
	'steam',
	'portable',
]

export const AVAILABILITY_BUCKETS = [
	'present',
	'not_applicable',
	'unverifiable',
] as const

export type AvailabilityBucket = (typeof AVAILABILITY_BUCKETS)[number]

export const AVAILABILITY_BUCKET_LABELS: Record<AvailabilityBucket, string> = {
	present: 'Verified on disk',
	not_applicable: 'Launched by identity or protocol',
	unverifiable: 'Could not be checked',
}

export const ADDED_WITHIN_CHOICES = [1, 7, 30, 90] as const

export const UNUSED_FOR_CHOICES = [30, 90, 180, 365] as const

export interface SavedFilterCriteria {
	sources: AppSourceKind[]
	publishers: string[]
	availability: AvailabilityBucket[]
	addedWithinDays: number | null
	unusedForDays: number | null
}

export interface SavedFilter {
	id: string
	name: string
	criteria: SavedFilterCriteria
}

export const EMPTY_CRITERIA: SavedFilterCriteria = {
	sources: [],
	publishers: [],
	availability: [],
	addedWithinDays: null,
	unusedForDays: null,
}

function dayCount(value: unknown, max: number): number | null {
	return typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 1 &&
		value <= max
		? value
		: null
}

function uniqueStrings(value: unknown, keep: (item: string) => boolean) {
	if (!Array.isArray(value)) return []
	const seen = new Set<string>()
	const kept: string[] = []
	for (const item of value) {
		if (typeof item !== 'string') continue
		const trimmed = item.trim()
		const key = trimmed.toLocaleLowerCase()
		if (!trimmed || seen.has(key) || !keep(trimmed)) continue
		seen.add(key)
		kept.push(trimmed)
	}
	return kept
}

export function normalizeCriteria(value: unknown): SavedFilterCriteria {
	const raw =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {}
	return {
		sources: uniqueStrings(raw.sources, item =>
			SAVED_FILTER_SOURCES.includes(item as AppSourceKind),
		) as AppSourceKind[],
		publishers: uniqueStrings(raw.publishers, () => true),
		availability: uniqueStrings(raw.availability, item =>
			AVAILABILITY_BUCKETS.includes(item as AvailabilityBucket),
		) as AvailabilityBucket[],
		addedWithinDays: dayCount(raw.addedWithinDays, MAX_ADDED_WITHIN_DAYS),
		unusedForDays: dayCount(raw.unusedForDays, MAX_UNUSED_FOR_DAYS),
	}
}

export function normalizeSavedFilter(value: unknown): SavedFilter | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const raw = value as Record<string, unknown>
	const id = typeof raw.id === 'string' ? raw.id.trim() : ''
	const name = typeof raw.name === 'string' ? raw.name.trim() : ''
	if (
		!id.startsWith('filter:') ||
		!name ||
		[...name].length > MAX_SAVED_FILTER_NAME_LENGTH
	)
		return null
	return { id, name, criteria: normalizeCriteria(raw.criteria) }
}

export function isEmptyCriteria(criteria: SavedFilterCriteria): boolean {
	return (
		criteria.sources.length === 0 &&
		criteria.publishers.length === 0 &&
		criteria.availability.length === 0 &&
		criteria.addedWithinDays === null &&
		criteria.unusedForDays === null
	)
}

export function catalogPublishers(apps: AppInfo[]): string[] {
	const seen = new Map<string, string>()
	for (const app of apps) {
		const publisher = app.publisher?.trim()
		if (!publisher) continue
		const key = publisher.toLocaleLowerCase()
		if (!seen.has(key)) seen.set(key, publisher)
	}
	return [...seen.values()].sort((left, right) => left.localeCompare(right))
}
