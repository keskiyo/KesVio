import { type AppInfo, elevationSupport } from '../../../entities/app'
import type { AppFileActions, ElevationOffer } from '../types'

export function elevationOffer(
	app: AppInfo,
	isHidden: boolean,
	fileActions: AppFileActions,
): ElevationOffer {
	if (isHidden || !fileActions.launchElevated) return 'refused'
	const support = elevationSupport(app)
	if (support === 'available') return 'offered'
	return support === 'ask-windows' && fileActions.canLaunchElevated
		? 'ask-windows'
		: 'refused'
}

export async function isElevationOffered(
	app: AppInfo,
	isHidden: boolean,
	fileActions: AppFileActions,
): Promise<boolean> {
	const offer = elevationOffer(app, isHidden, fileActions)
	if (offer !== 'ask-windows') return offer === 'offered'
	return (await fileActions.canLaunchElevated?.(app)) ?? false
}
