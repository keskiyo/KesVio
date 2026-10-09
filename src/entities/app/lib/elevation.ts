import type { AppInfo } from '../model/app.types'

const LAUNCH_URI_SCHEMES = ['steam:']

export type ElevationSupport = 'available' | 'unavailable' | 'ask-windows'

function isLaunchUri(path: string): boolean {
	const target = path.trim().toLowerCase()
	return LAUNCH_URI_SCHEMES.some(scheme => target.startsWith(scheme))
}

export function elevationSupport(
	app: Pick<AppInfo, 'launchKind' | 'path'>,
): ElevationSupport {
	if (isLaunchUri(app.path)) return 'unavailable'
	return app.launchKind === 'app_user_model_id' ? 'ask-windows' : 'available'
}

export function canOpenFolderFromMenu(
	app: Pick<AppInfo, 'launchKind' | 'sourceKind' | 'platformKind'>,
): boolean {
	if (app.launchKind !== 'app_user_model_id') return true
	return (
		app.sourceKind === 'start_apps' &&
		app.platformKind !== 'microsoft_store'
	)
}
