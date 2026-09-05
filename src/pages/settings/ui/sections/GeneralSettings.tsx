import { AppWindow, Keyboard, Minimize2 } from 'lucide-react'
import { ACTION_BUTTON_PRIMARY, ROW_CHIP } from '../../data'
import { CatalogDensityRow } from './CatalogDensityRow'
import { SettingsSectionHeader } from '../components/SettingsSectionHeader'
import { SettingsToggle } from '../components/SettingsToggle'
import { SettingsUpdateControls } from './SettingsUpdateControls'
import { StartupSettingsRow } from './StartupSettingsRow'
import type { GeneralSettingsProps } from '../../types'

const SECTION_LABEL =
	'border-b border-slate-200 bg-slate-50/35 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'

export function GeneralSettings({
	settings,
	updater,
	saving,
	density,
	onSetDensity,
	onSetCloseBehavior,
	onOpenGithub,
	onOpenTelegram,
	onOpenAppsSettings,
	onOpenStartupSettings,
}: GeneralSettingsProps) {
	const hideToTray = settings?.hideToTrayOnClose ?? true
	return (
		<>
			<div className="settings-surface mt-5 overflow-hidden rounded-2xl border border-white/85 bg-white/58">
				<p className={SECTION_LABEL}>Appearance</p>
				<CatalogDensityRow
					density={density}
					onSetDensity={onSetDensity}
				/>
				<p className={SECTION_LABEL}>Startup &amp; window</p>
				<StartupSettingsRow
					onOpenStartupSettings={onOpenStartupSettings}
				/>
				<div className="flex items-center gap-4 border-b border-slate-200 p-5">
					<SettingsSectionHeader
						icon={Minimize2}
						title="Keep running in the tray"
						description={
							hideToTray
								? 'Closing the window leaves AppNook in the notification area.'
								: 'Closing the window quits AppNook.'
						}
					/>
					<SettingsToggle
						label="Keep running in the tray when the window is closed"
						checked={hideToTray}
						disabled={!settings || saving}
						onToggle={() => void onSetCloseBehavior(!hideToTray)}
					/>
				</div>
				<p className={SECTION_LABEL}>System</p>
				<div className="flex items-center gap-4 border-b border-slate-200 p-5">
					<SettingsSectionHeader
						icon={Keyboard}
						title="Global shortcut"
						description="Works in any keyboard layout."
					/>
					<kbd className={ROW_CHIP}>
						{settings?.shortcut.label ?? 'Win+Shift+Q'}
					</kbd>
				</div>
				<div className="flex items-center gap-4 border-b border-slate-200 p-5">
					<SettingsSectionHeader
						icon={AppWindow}
						title="Windows installed apps"
						description="Open Windows Settings."
					/>
					<button
						type="button"
						aria-label="Open Windows installed apps"
						onClick={() => void onOpenAppsSettings()}
						className={ACTION_BUTTON_PRIMARY}
					>
						Open
					</button>
				</div>
				<p className={SECTION_LABEL}>Updates &amp; links</p>
				<SettingsUpdateControls
					updater={updater}
					onOpenGithub={onOpenGithub}
					onOpenTelegram={onOpenTelegram}
				/>
			</div>
			{settings?.shortcut.error && (
				<p className="mt-4 text-sm text-amber-700">
					{settings.shortcut.error}
				</p>
			)}
		</>
	)
}
