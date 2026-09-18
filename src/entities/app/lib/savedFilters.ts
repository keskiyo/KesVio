import { appIdentity } from './appIdentity'
import type { AppInfo, AppSourceKind } from '../model/app.types'

export const MAX_SAVED_FILTERS = 20
export const MAX_SAVED_FILTER_NAME_LENGTH = 64
const MAX_ADDED_WITHIN_DAYS = 365

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

export interface SavedFilterCriteria {
	sources: AppSourceKind[]
	publishers: string[]
	availability: AvailabilityBucket[]
	addedWithinDays: number | null
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
}

const DAY_MS = 86_400_000

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
	const days = raw.addedWithinDays
	return {
		sources: uniqueStrings(raw.sources, item =>
			SAVED_FILTER_SOURCES.includes(item as AppSourceKind),
		) as AppSourceKind[],
		publishers: uniqueStrings(raw.publishers, () => true),
		availability: uniqueStrings(raw.availability, item =>
			AVAILABILITY_BUCKETS.includes(item as AvailabilityBucket),
		) as AvailabilityBucket[],
		addedWithinDays:
			typeof days === 'number' &&
			Number.isInteger(days) &&
			days >= 1 &&
			days <= MAX_ADDED_WITHIN_DAYS
				? days
				: null,
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
		criteria.addedWithinDays === null
	)
}

export function savedFilterSources(app: AppInfo): AppSourceKind[] {
	return app.platformKind === 'steam' && app.sourceKind !== 'steam'
		? [app.sourceKind, 'steam']
		: [app.sourceKind]
}

export function availabilityBucket(app: AppInfo): AvailabilityBucket | null {
	const reason = app.targetAvailability ?? ''
	if (reason === 'target.present') return 'present'
	if (reason.startsWith('target.not_applicable.')) return 'not_applicable'
	if (reason.startsWith('target.unverifiable.')) return 'unverifiable'
	return null
}

export function matchesSavedFilter(
	app: AppInfo,
	criteria: SavedFilterCriteria,
	firstSeenAt: number | undefined,
	now: number,
): boolean {
	if (criteria.sources.length) {
		const sources = savedFilterSources(app)
		if (!criteria.sources.some(source => sources.includes(source)))
			return false
	}
	if (criteria.publishers.length) {
		const publisher = (app.publisher ?? '').trim().toLocaleLowerCase()
		if (
			!publisher ||
			!criteria.publishers.some(
				entry => entry.toLocaleLowerCase() === publisher,
			)
		)
			return false
	}
	if (criteria.availability.length) {
		const bucket = availabilityBucket(app)
		if (!bucket || !criteria.availability.includes(bucket)) return false
	}
	if (criteria.addedWithinDays !== null) {
		if (
			firstSeenAt === undefined ||
			!Number.isFinite(firstSeenAt) ||
			firstSeenAt > now
		)
			return false
		if (now - firstSeenAt > criteria.addedWithinDays * DAY_MS) return false
	}
	return true
}

export function applySavedFilter(
	apps: AppInfo[],
	criteria: SavedFilterCriteria,
	firstSeenAt: Record<string, number>,
	now: number,
): AppInfo[] {
	if (isEmptyCriteria(criteria)) return apps
	return apps.filter(app =>
		matchesSavedFilter(app, criteria, firstSeenAt[appIdentity(app)], now),
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
