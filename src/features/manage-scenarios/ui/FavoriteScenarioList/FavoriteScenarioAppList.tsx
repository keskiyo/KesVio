import { AppWindow } from 'lucide-react'
import type { AppInfo } from '../../../../entities/app'
import type { UnavailableScenarioApp } from '../../../../entities/scenario'

interface FavoriteScenarioAppListProps {
	label: string
	scenarioName: string
	apps: AppInfo[]
	unavailable: UnavailableScenarioApp[]
}

export function FavoriteScenarioAppList({
	label,
	scenarioName,
	apps,
	unavailable,
}: FavoriteScenarioAppListProps) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<span className="text-[0.6875rem] font-semibold tracking-[.12em] text-(--text-subtle) uppercase">
				{label}
			</span>
			{apps.length === 0 && unavailable.length === 0 ? (
				<p className="text-xs text-(--text-muted)">Nothing here yet.</p>
			) : (
				<ul
					aria-label={`${label} list of ${scenarioName}`}
					className="flex min-w-0 flex-wrap gap-1.5"
				>
					{apps.map(app => (
						<li
							key={app.id}
							aria-label={app.name}
							title={app.name}
							className="grid size-8 shrink-0 place-items-center rounded-md border border-(--border-neutral) bg-(--surface-panel)"
						>
							{app.iconBase64 ? (
								<img
									src={app.iconBase64}
									alt=""
									className="size-5 shrink-0 object-contain"
									draggable={false}
								/>
							) : (
								<AppWindow
									size={16}
									aria-hidden="true"
									className="shrink-0 text-(--text-muted)"
								/>
							)}
						</li>
					))}
					{unavailable.map(entry => (
						<li
							key={entry.identity}
							aria-label={`${entry.name}, unavailable`}
							title={`${entry.name} — Unavailable`}
							className="grid size-8 shrink-0 place-items-center rounded-md border border-dashed border-(--border-neutral) bg-(--surface-inset) opacity-75"
						>
							{entry.iconBase64 ? (
								<img
									src={entry.iconBase64}
									alt=""
									className="size-5 shrink-0 object-contain grayscale"
									draggable={false}
								/>
							) : (
								<AppWindow
									size={16}
									aria-hidden="true"
									className="shrink-0 text-(--text-muted)"
								/>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
