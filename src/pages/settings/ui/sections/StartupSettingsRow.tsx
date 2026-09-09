import { LogIn } from 'lucide-react'
import { ACTION_BUTTON_PRIMARY } from '../../data'
import { SettingsRow } from '../components/SettingsRow'

interface StartupSettingsRowProps {
	onOpenStartupSettings(): Promise<void>
}

export function StartupSettingsRow({
	onOpenStartupSettings,
}: StartupSettingsRowProps) {
	return (
		<SettingsRow
			icon={LogIn}
			title="Launch when Windows starts"
			description="Listed in Windows, switched off."
		>
			<button
				type="button"
				aria-label="Manage startup in Windows"
				onClick={() => void onOpenStartupSettings()}
				className={ACTION_BUTTON_PRIMARY}
			>
				Manage
			</button>
		</SettingsRow>
	)
}
