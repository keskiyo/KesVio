import { AppWindow } from 'lucide-react'
import type { ScenarioAppStackProps } from './types'

const MAX_TILES = 5

export function ScenarioAppStack({ apps, extra }: ScenarioAppStackProps) {
	if (apps.length === 0 && extra === 0) return null
	const shown = apps.slice(0, MAX_TILES)
	const hidden = apps.length - shown.length + extra
	return (
		<span
			aria-hidden="true"
			className="flex shrink-0 items-center -space-x-1.5"
		>
			{shown.map(app => (
				<span
					key={app.id}
					className="grid size-6 place-items-center rounded-md border border-(--border-neutral) bg-(--surface-panel)"
				>
					{app.iconBase64 ? (
						<img
							src={app.iconBase64}
							alt=""
							className="size-4 object-contain"
							draggable={false}
						/>
					) : (
						<AppWindow size={12} className="text-(--text-muted)" />
					)}
				</span>
			))}
			{hidden > 0 && (
				<span className="grid h-6 min-w-6 place-items-center rounded-md border border-(--border-neutral) bg-(--surface-inset) px-1 text-[0.625rem] font-medium text-(--text-muted)">
					+{hidden}
				</span>
			)}
		</span>
	)
}
