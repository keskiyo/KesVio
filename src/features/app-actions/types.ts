import type { AppInfo } from '../../entities/app'

export interface AppFileActions {
	openFolder(app: AppInfo): Promise<void>
	copyPath(app: AppInfo): Promise<void>
	launchElevated?(app: AppInfo): Promise<void>
	canLaunchElevated?(app: AppInfo): Promise<boolean>
}

export type ElevationOffer = 'offered' | 'ask-windows' | 'refused'
