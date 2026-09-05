import { AppInfoDialog } from '../../features/view-app-details'
import { CommandPalette } from '../../features/command-palette'
import { InstallerLaunchDialog } from '../../features/launch-app'
import { AppErrorBoundary } from '../AppErrorBoundary'
import type { AppDialogsProps } from '../types'

export function AppDialogs({
	appsClient,
	categories,
	dialogs,
	paletteApps,
	paletteSuggestions,
	onError,
}: AppDialogsProps) {
	const { appInfo, installerLaunch, palette } = dialogs
	return (
		<AppErrorBoundary fallback={null} onError={onError}>
			{palette.open && (
				<CommandPalette
					apps={paletteApps}
					suggestions={paletteSuggestions}
					onLaunch={installerLaunch.requestLaunch}
					onClose={palette.close}
				/>
			)}
			{appInfo.app && (
				<AppInfoDialog
					app={appInfo.app}
					categories={categories}
					appsClient={appsClient}
					onClose={appInfo.close}
				/>
			)}
			{installerLaunch.app && (
				<InstallerLaunchDialog
					app={installerLaunch.app}
					pending={installerLaunch.pending}
					onCancel={installerLaunch.cancel}
					onConfirm={installerLaunch.confirm}
				/>
			)}
		</AppErrorBoundary>
	)
}
