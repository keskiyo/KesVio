import { Clock, ExternalLink, RefreshCw, Send } from 'lucide-react'
import { ACTION_BUTTON_PRIMARY, ACTION_BUTTON_QUIET } from '../../data'
import { GithubIcon } from '../../../../shared/ui/GithubIcon'
import type { SettingsUpdateControlsProps } from '../../types'
import { SettingsRow } from '../components/SettingsRow'
import { SettingsSectionHeader } from '../components/SettingsSectionHeader'
import { SettingsToggle } from '../components/SettingsToggle'
import { updateStatusText } from './updateStatusText'

export function SettingsUpdateControls({
	updater,
	onOpenGithub,
	onOpenTelegram,
}: SettingsUpdateControlsProps) {
	return (
		<>
			<SettingsRow
				icon={GithubIcon}
				title="Updates and source"
				description={
					updater.update
						? `Version ${updater.update.version} is available.`
						: updateStatusText(updater.status)
				}
			>
				<button
					type="button"
					disabled={updater.status === 'checking'}
					onClick={() => void updater.checkNow()}
					className={ACTION_BUTTON_PRIMARY}
				>
					<RefreshCw
						size={16}
						className={
							updater.status === 'checking' ? 'animate-spin' : ''
						}
						aria-hidden="true"
					/>
					Check updates
				</button>
				<button
					type="button"
					aria-label="Open KesVio on GitHub"
					onClick={() => void onOpenGithub()}
					className={ACTION_BUTTON_QUIET}
				>
					<GithubIcon size={16} aria-hidden="true" />
					keskiyo
				</button>
			</SettingsRow>
			<div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
				<SettingsSectionHeader
					icon={Clock}
					title="Automatic update checks"
					description={
						updater.automaticChecks
							? 'At most one check every four hours, on start.'
							: 'Only when you press Check updates.'
					}
				/>
				<SettingsToggle
					label="Check for updates automatically"
					checked={updater.automaticChecks}
					onToggle={() =>
						updater.setAutomaticChecks(!updater.automaticChecks)
					}
				/>
			</div>
			<button
				type="button"
				aria-label="Open @keskiyo on Telegram"
				onClick={() => void onOpenTelegram()}
				className="flex w-full items-center gap-4 p-5 text-left hover:bg-violet-100/55 focus-visible:outline-2 focus-visible:outline-violet-500"
			>
				<span className="telegram-accent grid size-10 place-items-center rounded-xl">
					<Send size={19} aria-hidden="true" />
				</span>
				<span className="flex-1">
					<span className="block font-medium">Telegram</span>
					<span className="mt-1 block text-sm text-slate-600">
						@keskiyo
					</span>
				</span>
				<ExternalLink
					size={17}
					className="text-slate-500"
					aria-hidden="true"
				/>
			</button>
		</>
	)
}
