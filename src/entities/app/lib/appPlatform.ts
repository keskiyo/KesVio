import type { AppInfo, AppPlatformKind } from '../model/app.types'

export const PLATFORM_LABELS: Record<AppPlatformKind, string> = {
	steam: 'Steam',
	battle_net: 'Battle.net',
	microsoft_store: 'Microsoft Store',
	portable: 'Portable',
}

const LAUNCH_SOURCES = new Set<AppPlatformKind>([
	'steam',
	'battle_net',
	'microsoft_store',
])

export function launchSourceLabel(
	platformKind: AppInfo['platformKind'],
): string | null {
	return platformKind && LAUNCH_SOURCES.has(platformKind)
		? PLATFORM_LABELS[platformKind]
		: null
}
