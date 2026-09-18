import { AppRow } from '../AppRow/AppRow'
import type { ArtifactSectionProps } from './types'

export function ArtifactSection({
	icon: Icon,
	title,
	apps,
	...actions
}: ArtifactSectionProps) {
	return (
		<section aria-label={`${title} ${apps.length}`} className="space-y-3">
			<h2
				aria-label={`${title} ${apps.length}`}
				className="flex items-center gap-3 text-base font-semibold text-(--text-primary)"
			>
				<Icon size={18} aria-hidden="true" className="shrink-0" />
				<span className="shrink-0">{title}</span>
				<span
					aria-hidden="true"
					className="h-px min-w-4 flex-1 bg-(--border-neutral)"
				/>
				<span className="shrink-0 text-sm font-normal text-(--text-muted) tabular-nums">
					{apps.length}
				</span>
			</h2>
			<div className="grid min-w-0 grid-cols-1 gap-2.5 min-[769px]:grid-cols-2 min-[1601px]:grid-cols-3">
				{apps.map(app => (
					<AppRow
						key={app.id}
						app={app}
						categories={actions.categories}
						categoryOrder={actions.categoryOrder}
						isHidden={false}
						onLaunch={actions.onLaunch}
						onMove={actions.onMoveApp}
						onInfo={actions.onInfo}
						onOpenFolder={actions.onOpenFolder}
						onManageInWindows={actions.onManageInWindows}
						onHide={actions.onHide}
						onRestore={actions.onRestore}
						onDemote={actions.onDemoteAuxiliary}
					/>
				))}
			</div>
		</section>
	)
}
