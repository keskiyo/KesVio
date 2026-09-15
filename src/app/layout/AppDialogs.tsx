import { AppInfoDialog } from '../../features/view-app-details'
import { CommandPalette } from '../../features/command-palette'
import { InstallerLaunchDialog } from '../../features/launch-app'
import { SavedFilterDialog } from '../../features/manage-filters'
import { ScenarioRunDialog } from '../../features/manage-scenarios'
import { AppErrorBoundary } from '../AppErrorBoundary'
import type { AppDialogsProps } from '../types'

export function AppDialogs({
	appsClient,
	categories,
	dialogs,
	paletteApps,
	paletteSuggestions,
	scenarioLauncher,
	savedFilterEditor,
	onError,
}: AppDialogsProps) {
	const { appInfo, installerLaunch, palette } = dialogs
	const editing = dialogs.savedFilterEditor.state
	const editingFilter = editing?.filter ?? null
	return (
		<AppErrorBoundary fallback={null} onError={onError}>
			{editing && (
				<SavedFilterDialog
					filter={editingFilter}
					publishers={savedFilterEditor.publishers}
					onSave={(name, criteria) =>
						editingFilter
							? savedFilterEditor.onUpdate(
									editingFilter.id,
									name,
									criteria,
								)
							: savedFilterEditor.onCreate(name, criteria)
					}
					onDelete={
						editingFilter
							? () => {
									savedFilterEditor.onDelete(editingFilter.id)
									dialogs.savedFilterEditor.close()
								}
							: undefined
					}
					onClose={dialogs.savedFilterEditor.close}
				/>
			)}
			{palette.open && (
				<CommandPalette
					apps={paletteApps}
					suggestions={paletteSuggestions}
					onLaunch={installerLaunch.requestLaunch}
					onClose={palette.close}
				/>
			)}
			{dialogs.scenarioLauncher.open && (
				<ScenarioRunDialog
					{...scenarioLauncher}
					onClose={dialogs.scenarioLauncher.close}
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
