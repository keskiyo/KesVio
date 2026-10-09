import { appIdentity } from './appIdentity'
import { type AppLaunchStats, lastUseMoment } from './launchHistory'
import {
	type AvailabilityBucket,
	isEmptyCriteria,
	type SavedFilterCriteria,
} from './savedFilters'
import type { AppInfo, AppSourceKind } from '../model/app.types'

const DAY_MS = 86_400_000

export interface SavedFilterUsage {
	appLaunchStats: AppLaunchStats
	launchHistorySince: number | null
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

function withinPast(
	moment: number | undefined | null,
	days: number,
	now: number,
) {
	return (
		typeof moment === 'number' &&
		Number.isFinite(moment) &&
		moment <= now &&
		now - moment <= days * DAY_MS
	)
}

export function matchesSavedFilter(
	app: AppInfo,
	criteria: SavedFilterCriteria,
	firstSeenAt: number | undefined,
	now: number,
	lastUsedAt: number | null = null,
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
	if (
		criteria.addedWithinDays !== null &&
		!withinPast(firstSeenAt, criteria.addedWithinDays, now)
	)
		return false
	if (criteria.unusedForDays !== null) {
		if (lastUsedAt === null || lastUsedAt > now) return false
		if (withinPast(lastUsedAt, criteria.unusedForDays, now)) return false
	}
	return true
}

export function applySavedFilter(
	apps: AppInfo[],
	criteria: SavedFilterCriteria,
	firstSeenAt: Record<string, number>,
	now: number,
	usage: SavedFilterUsage = { appLaunchStats: {}, launchHistorySince: null },
): AppInfo[] {
	if (isEmptyCriteria(criteria)) return apps
	return apps.filter(app => {
		const identity = appIdentity(app)
		const lastUsedAt =
			criteria.unusedForDays === null
				? null
				: lastUseMoment(
						usage.appLaunchStats[identity],
						firstSeenAt[identity],
						usage.launchHistorySince,
					)
		return matchesSavedFilter(
			app,
			criteria,
			firstSeenAt[identity],
			now,
			lastUsedAt,
		)
	})
}
