import {
	type SettingsArea,
	useSystemSettings,
} from '../../../features/edit-settings'
import { CatalogSettings } from './sections/CatalogSettings'
import { GeneralSettings } from './sections/GeneralSettings'
import { UnclassifiedApps } from './sections/UnclassifiedApps/UnclassifiedApps'
import type { SettingsPageProps } from '../types'

export function SettingsPage({
	client,
	density,
	onSetDensity,
	onForceFullScan,
	onResetCatalogCache,
	unclassifiedApps,
	categories,
	categoryOrder,
	onMoveApp,
	updater,
}: SettingsPageProps) {
	const {
		settings,
		error,
		errorArea,
		saving,
		confirming,
		setConfirming,
		forcing,
		resetting,
		saveScanSettings,
		setCloseBehavior,
		setStartupEnabled,
		addPath,
		removePath,
		forceFullScan,
		resetCatalogCache,
	} = useSystemSettings({ client, onForceFullScan, onResetCatalogCache })
	const areaError = (area: SettingsArea) =>
		error && errorArea === area ? (
			<p role="alert" className="mt-3 text-sm text-red-700">
				{error}
			</p>
		) : null
	return (
		<section aria-labelledby="settings-title" className="mx-auto max-w-3xl">
			<h1 id="settings-title" className="sr-only">
				Settings
			</h1>
			<GeneralSettings
				settings={settings}
				updater={updater}
				saving={saving}
				density={density}
				onSetDensity={onSetDensity}
				onSetCloseBehavior={setCloseBehavior}
				onOpenGithub={client.openGithub}
				onOpenTelegram={client.openTelegram}
				onOpenAppsSettings={client.openAppsSettings}
				onSetStartupEnabled={setStartupEnabled}
			/>
			{areaError('settings')}
			<CatalogSettings
				discovery={{
					settings,
					saving,
					onSaveScanSettings: saveScanSettings,
					onAddPath: addPath,
					onRemovePath: removePath,
					onPickFolder: client.pickFolder,
				}}
				maintenance={
					onForceFullScan
						? {
								forcing,
								resetting,
								confirming,
								canReset: Boolean(onResetCatalogCache),
								setConfirming,
								onForceFullScan: forceFullScan,
								onResetCatalogCache: resetCatalogCache,
							}
						: null
				}
			/>
			{areaError('discovery')}
			{areaError('maintenance')}
			{unclassifiedApps && categories && categoryOrder && onMoveApp && (
				<UnclassifiedApps
					apps={unclassifiedApps}
					categories={categories}
					categoryOrder={categoryOrder}
					onMoveApp={onMoveApp}
				/>
			)}
		</section>
	)
}
