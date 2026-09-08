import { ACTION_ROW } from '../../data'
import { SettingsSectionHeader } from './SettingsSectionHeader'
import type { SettingsRowProps } from '../../types'

export function SettingsRow({
	icon,
	title,
	description,
	children,
}: SettingsRowProps) {
	return (
		<div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
			<div className="flex min-w-0 flex-1 items-center gap-4">
				<SettingsSectionHeader
					icon={icon}
					title={title}
					description={description}
				/>
			</div>
			<div className={`${ACTION_ROW} w-full sm:ml-auto sm:w-auto`}>
				{children}
			</div>
		</div>
	)
}
