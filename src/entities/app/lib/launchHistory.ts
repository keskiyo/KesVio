import { appIdentity } from './appIdentity'
import type { AppInfo } from '../model/app.types'

export interface AppLaunchStat {
	count: number
	lastLaunchedAt: number
}

export type AppLaunchStats = Record<string, AppLaunchStat>

export const MAX_LAUNCH_STATS = 500
const MAX_LAUNCH_COUNT = 1_000_000
const DAY_MS = 86_400_000

const RECENCY_WEIGHTS: readonly [maxDays: number, weight: number][] = [
	[4, 1],
	[14, 0.7],
	[31, 0.5],
	[90, 0.3],
]
const STALE_WEIGHT = 0.1

function capLaunchStats(stats: AppLaunchStats): AppLaunchStats {
	const entries = Object.entries(stats)
	if (entries.length <= MAX_LAUNCH_STATS) return stats
	return Object.fromEntries(
		entries
			.sort(
				([, left], [, right]) =>
					right.lastLaunchedAt - left.lastLaunchedAt,
			)
			.slice(0, MAX_LAUNCH_STATS),
	)
}

export function recordLaunchStat(
	stats: AppLaunchStats,
	identity: string,
	now: number,
): AppLaunchStats {
	const count = Math.min((stats[identity]?.count ?? 0) + 1, MAX_LAUNCH_COUNT)
	return capLaunchStats({
		...stats,
		[identity]: { count, lastLaunchedAt: now },
	})
}

function readStat(value: unknown): AppLaunchStat | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const { count, lastLaunchedAt } = value as Record<string, unknown>
	if (
		typeof count !== 'number' ||
		!Number.isInteger(count) ||
		count < 1 ||
		typeof lastLaunchedAt !== 'number' ||
		!Number.isFinite(lastLaunchedAt) ||
		lastLaunchedAt <= 0
	)
		return null
	return { count: Math.min(count, MAX_LAUNCH_COUNT), lastLaunchedAt }
}

export function normalizeLaunchStats(value: unknown): AppLaunchStats {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
	const stats: AppLaunchStats = {}
	for (const [identity, raw] of Object.entries(value)) {
		const stat = readStat(raw)
		if (identity.trim() && stat) stats[identity] = stat
	}
	return capLaunchStats(stats)
}

export function lastUseMoment(
	stat: AppLaunchStat | undefined,
	firstSeenAt: number | undefined,
	launchHistorySince: number | null,
): number | null {
	if (stat) return stat.lastLaunchedAt
	const known = [firstSeenAt, launchHistorySince].filter(
		(moment): moment is number =>
			typeof moment === 'number' && Number.isFinite(moment),
	)
	return known.length ? Math.max(...known) : null
}

function recencyWeight(ageMs: number): number {
	const days = Math.max(0, ageMs) / DAY_MS
	return (
		RECENCY_WEIGHTS.find(([maxDays]) => days < maxDays)?.[1] ?? STALE_WEIGHT
	)
}

function launchFrecency(stat: AppLaunchStat, now: number): number {
	return stat.count * recencyWeight(now - stat.lastLaunchedAt)
}

export function rankByFrecency(
	apps: AppInfo[],
	stats: AppLaunchStats,
	now: number,
): AppInfo[] {
	return apps
		.flatMap(app => {
			const stat = stats[appIdentity(app)]
			return stat ? [{ app, score: launchFrecency(stat, now) }] : []
		})
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.app.name.localeCompare(right.app.name),
		)
		.map(entry => entry.app)
}
