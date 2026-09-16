import { AppRow } from '../AppRow/AppRow'
import type { ArtifactSectionProps } from './types'

export function ArtifactSection({
	title,
	apps,
	...actions
}: ArtifactSectionProps) {
	return (
		<section aria-label={`${title} ${apps.length}`} className="space-y-3">
			<h2
				aria-label={`${title} ${apps.length}`}
				className="flex items-center gap-2 text-base font-semibold text-(--text-primary)"
			>
				{title}
				<span className="rounded-full border border-(--border-neutral) bg-(--surface-raised) px-2 py-0.5 text-xs text-(--text-muted)">
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
