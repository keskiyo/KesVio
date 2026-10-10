import { useEffect, useMemo, useRef } from 'react'
import {
	type AppInfo,
	type AppLaunchStats,
	appIdentity,
	createMarkLookup,
} from '../../entities/app'
import type { SystemClient, TrayFavoriteEntry } from '../../entities/system'

const MAX_TRAY_RECENT = 5

interface TrayRecentOptions {
	systemClient: Pick<SystemClient, 'setTrayRecent'>
	apps: AppInfo[]
	appLaunchStats: AppLaunchStats
	hiddenAppIds: string[]
	hiddenAppIdentities: string[]
}

export function pickTrayRecent(
	apps: AppInfo[],
	stats: AppLaunchStats,
	isHidden: (app: AppInfo) => boolean,
): TrayFavoriteEntry[] {
	const seen = new Set<string>()
	return apps
		.flatMap(app => {
			const identity = appIdentity(app)
			const stat = stats[identity]
			if (!stat || isHidden(app) || seen.has(identity)) return []
			seen.add(identity)
			return [{ app, at: stat.lastLaunchedAt }]
		})
		.sort((left, right) => right.at - left.at)
		.slice(0, MAX_TRAY_RECENT)
		.map(({ app }) => ({ id: app.id, label: app.name }))
}

export function useTrayRecent({
	systemClient,
	apps,
	appLaunchStats,
	hiddenAppIds,
	hiddenAppIdentities,
}: TrayRecentOptions) {
	const sent = useRef<string | null>(null)
	const isHidden = useMemo(
		() => createMarkLookup(hiddenAppIds, hiddenAppIdentities),
		[hiddenAppIds, hiddenAppIdentities],
	)

	useEffect(() => {
		const recent = pickTrayRecent(apps, appLaunchStats, isHidden)
		const serialized = JSON.stringify(recent)
		if (serialized === sent.current) return
		sent.current = serialized
		void systemClient.setTrayRecent?.(recent).catch(() => {
			sent.current = null
		})
	}, [apps, appLaunchStats, isHidden, systemClient])
}
