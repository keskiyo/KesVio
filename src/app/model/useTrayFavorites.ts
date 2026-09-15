import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { AppInfo, AppView } from '../../entities/app'
import type { SystemClient, TrayFavoriteEntry } from '../../entities/system'

export const MAX_TRAY_FAVORITES = 5

interface TrayFavoritesOptions {
	systemClient: Pick<
		SystemClient,
		'setTrayFavorites' | 'onTrayLaunchApp' | 'onTrayShowFavorites'
	>
	apps: AppInfo[]
	favoriteAppIds: string[]
	onLaunch(app: AppInfo): Promise<void>
	selectView(view: AppView): void
}

export function pickTrayFavorites(
	apps: AppInfo[],
	favoriteAppIds: string[],
): { entries: TrayFavoriteEntry[]; more: boolean } {
	const byId = new Map(apps.map(app => [app.id, app]))
	const favorites = favoriteAppIds
		.map(id => byId.get(id))
		.filter((app): app is AppInfo => app !== undefined)
	return {
		entries: favorites
			.slice(0, MAX_TRAY_FAVORITES)
			.map(app => ({ id: app.id, label: app.name })),
		more: favorites.length > MAX_TRAY_FAVORITES,
	}
}

export function useTrayFavorites({
	systemClient,
	apps,
	favoriteAppIds,
	onLaunch,
	selectView,
}: TrayFavoritesOptions) {
	const latest = useRef({ apps, onLaunch, selectView })
	const sent = useRef<string | null>(null)
	latest.current = { apps, onLaunch, selectView }

	useEffect(() => {
		const picked = pickTrayFavorites(apps, favoriteAppIds)
		const serialized = JSON.stringify(picked)
		if (serialized === sent.current) return
		sent.current = serialized
		void systemClient
			.setTrayFavorites?.(picked.entries, picked.more)
			.catch(() => {
				sent.current = null
			})
	}, [apps, favoriteAppIds, systemClient])

	useEffect(() => {
		let active = true
		const stops: Array<() => void> = []
		const hold = (registration: Promise<() => void> | undefined) => {
			registration
				?.then(stop => {
					if (active) stops.push(stop)
					else stop()
				})
				.catch(() => {})
		}
		hold(
			systemClient.onTrayLaunchApp?.(id => {
				if (!active) return
				const app = latest.current.apps.find(
					candidate => candidate.id === id,
				)
				if (app) void latest.current.onLaunch(app)
				else toast.error('This favorite is no longer in the catalog')
			}),
		)
		hold(
			systemClient.onTrayShowFavorites?.(() => {
				if (active) latest.current.selectView('favorites')
			}),
		)
		return () => {
			active = false
			stops.splice(0).forEach(stop => stop())
		}
	}, [systemClient])
}
