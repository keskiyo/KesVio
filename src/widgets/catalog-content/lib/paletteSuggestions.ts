import {
	type AppInfo,
	type AppLaunchStats,
	appIdentity,
	rankByFrecency,
	selectRecentApps,
} from '../../../entities/app'

const PALETTE_SUGGESTIONS = 12

interface PaletteSuggestionInput {
	apps: AppInfo[]
	favoriteAppIds: string[]
	firstSeenAt: Record<string, number>
	appLaunchStats: AppLaunchStats
	now: number
}

export function buildPaletteSuggestions({
	apps,
	favoriteAppIds,
	firstSeenAt,
	appLaunchStats,
	now,
}: PaletteSuggestionInput): AppInfo[] {
	const favorites = new Set(favoriteAppIds)
	const starred = apps.filter(app => favorites.has(app.id))
	const rest = apps.filter(app => !favorites.has(app.id))
	const habitual = rankByFrecency(rest, appLaunchStats, now)
	const suggested = new Set(habitual)
	return [
		...starred,
		...habitual,
		...selectRecentApps(
			rest.filter(app => !suggested.has(app)),
			app => firstSeenAt[appIdentity(app)] ?? 0,
			PALETTE_SUGGESTIONS,
		),
	].slice(0, PALETTE_SUGGESTIONS)
}
