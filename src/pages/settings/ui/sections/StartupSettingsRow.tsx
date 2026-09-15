import { LogIn } from 'lucide-react'
import { SettingsSectionHeader } from '../components/SettingsSectionHeader'
import { SettingsToggle } from '../components/SettingsToggle'
import type { StartupSettingsRowProps } from '../../types'
import type { StartupEntryState } from '../../../../entities/system'

const DESCRIPTIONS: Record<StartupEntryState, string> = {
	enabled: 'KesVio starts hidden in the tray when you sign in.',
	disabled: 'KesVio starts only when you open it.',
	missing:
		'The Windows startup entry is missing. Reinstall KesVio to restore it.',
}

export function StartupSettingsRow({
	startupEntry,
	saving,
	onSetStartupEnabled,
}: StartupSettingsRowProps) {
	const enabled = startupEntry === 'enabled'
	const locked = startupEntry === null || startupEntry === 'missing' || saving
	return (
		<div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
			<SettingsSectionHeader
				icon={LogIn}
				title="Launch when Windows starts"
				description={
					startupEntry
						? DESCRIPTIONS[startupEntry]
						: 'Checking Windows…'
				}
			/>
			<SettingsToggle
				label="Launch KesVio when Windows starts"
				checked={enabled}
				disabled={locked}
				onToggle={() => void onSetStartupEnabled(!enabled)}
			/>
		</div>
	)
}
