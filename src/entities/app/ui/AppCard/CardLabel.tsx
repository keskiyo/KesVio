import { displayVersion } from '../../lib/appMetadata'
import type { CardLabelProps } from './types'

export function CardLabel({ name, version, launching }: CardLabelProps) {
	return (
		<span className="flex w-full flex-col items-center gap-0.5">
			<span
				title={name}
				className={`app-card-name w-full truncate font-semibold ${launching ? 'text-violet-500' : 'text-slate-700 group-hover:text-slate-900'}`}
			>
				{launching ? 'Launching…' : name}
			</span>
			{!launching && version && (
				<span
					title={`Version ${displayVersion(version)}`}
					className="app-card-version w-full truncate text-xs text-slate-400"
				>
					v{displayVersion(version)}
				</span>
			)}
		</span>
	)
}
