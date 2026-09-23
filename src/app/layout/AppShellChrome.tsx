import { GlobalActivityBar } from './GlobalActivityBar'
import { PreferencesNotSavedBanner } from './PreferencesNotSavedBanner'
import { StaleCopyBanner } from '../../features/stale-copy'
import { TitleBar } from './TitleBar'
import type { AppShellChromeProps } from '../types'

export function AppShellChrome({
	activityActive,
	activityLabel,
	preferencesPersisted,
	staleCopy,
	systemClient,
	onDismissStaleCopy,
}: AppShellChromeProps) {
	return (
		<>
			<TitleBar />
			{staleCopy && (
				<StaleCopyBanner
					installedVersion={staleCopy.installedVersion}
					installLocation={staleCopy.installLocation}
					onOpenInstalled={() =>
						systemClient.openInstalledCopy?.() ?? Promise.resolve()
					}
					onDismiss={onDismissStaleCopy}
				/>
			)}
			{!preferencesPersisted && <PreferencesNotSavedBanner />}
			<GlobalActivityBar active={activityActive} label={activityLabel} />
		</>
	)
}
