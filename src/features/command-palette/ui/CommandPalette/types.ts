import type { AppInfo } from '../../../../entities/app'

export interface CommandPaletteProps {
	apps: AppInfo[]
	suggestions: AppInfo[]
	onLaunch(app: AppInfo): Promise<void>
	onLaunchElevated?(app: AppInfo): void
	onClose(): void
}

export interface ResultItemProps {
	app: AppInfo
	selected: boolean
	onHover(): void
	onActivate(): void
}
