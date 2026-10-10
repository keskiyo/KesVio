import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { type AppInfo, createMarkLookup } from '../../entities/app'
import {
	type AppFileActions,
	isElevationOffered,
} from '../../features/app-actions'

interface KeyboardLaunchOptions {
	query: string
	deferredQuery: string
	results: AppInfo[]
	catalogApps: AppInfo[]
	hiddenAppIds: string[]
	hiddenAppIdentities: string[]
	fileActions: AppFileActions
	onLaunch(app: AppInfo): void
	onFocusResults(): void
}

export function useKeyboardLaunch({
	query,
	deferredQuery,
	results,
	catalogApps,
	hiddenAppIds,
	hiddenAppIdentities,
	fileActions,
	onLaunch,
	onFocusResults,
}: KeyboardLaunchOptions) {
	const isHidden = useMemo(
		() => createMarkLookup(hiddenAppIds, hiddenAppIdentities),
		[hiddenAppIds, hiddenAppIdentities],
	)

	const elevate = useCallback(
		async (app: AppInfo) => {
			if (await isElevationOffered(app, isHidden(app), fileActions))
				await fileActions.launchElevated?.(app)
			else toast.info(`${app.name} cannot run as administrator`)
		},
		[fileActions, isHidden],
	)

	const bestMatch =
		query.trim() && query === deferredQuery ? (results[0] ?? null) : null

	const searchLaunch = useMemo(
		() => ({
			bestMatch: bestMatch?.name ?? null,
			onSubmit(elevated: boolean) {
				if (!bestMatch) return
				if (elevated) void elevate(bestMatch)
				else onLaunch(bestMatch)
			},
			onLeave: onFocusResults,
		}),
		[bestMatch, elevate, onLaunch, onFocusResults],
	)

	const elevateById = useCallback(
		(id: string) => {
			const app = catalogApps.find(entry => entry.id === id)
			if (app) void elevate(app)
		},
		[catalogApps, elevate],
	)

	return { searchLaunch, elevateById, elevate }
}
