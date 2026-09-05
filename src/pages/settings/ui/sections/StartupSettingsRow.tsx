import { LogIn } from 'lucide-react'
import { ACTION_BUTTON_QUIET } from '../../data'
import { SettingsSectionHeader } from '../components/SettingsSectionHeader'

interface StartupSettingsRowProps {
	onOpenStartupSettings(): Promise<void>
}

export function StartupSettingsRow({
	onOpenStartupSettings,
}: StartupSettingsRowProps) {
	return (
		<div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
			<SettingsSectionHeader
				icon={LogIn}
				title="Launch when Windows starts"
				description="Listed in Windows, switched off."
			/>
			<button
				type="button"
				aria-label="Manage startup in Windows"
				onClick={() => void onOpenStartupSettings()}
				className={`${ACTION_BUTTON_QUIET} ml-auto`}
			>
				Manage
			</button>
		</div>
	)
}
