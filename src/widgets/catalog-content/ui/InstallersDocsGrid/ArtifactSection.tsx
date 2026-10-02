import { FolderOpen } from 'lucide-react'
import { groupAppVersions } from '../../../../entities/app'
import { AppRow } from '../AppRow/AppRow'
import { APP_ROW_GRID, ROW_CHIP } from '../AppRow/data'
import { RowAction } from '../AppRow/RowAction'
import { VersionedRows } from '../AppRow/VersionedRows'
import type { ArtifactSectionProps } from './types'

export function ArtifactSection({
	icon: Icon,
	title,
	apps,
	newerInstalled,
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
			<div className={APP_ROW_GRID}>
				<VersionedRows
					groups={groupAppVersions(apps)}
					renderRow={(app, versionToggle) => {
						const installed = newerInstalled.get(app.id)
						return (
							<AppRow
								app={app}
								categories={actions.categories}
								categoryOrder={actions.categoryOrder}
								isHidden={false}
								onLaunch={actions.onLaunch}
								onMove={actions.onMoveApp}
								onInfo={actions.onInfo}
								onManageInWindows={actions.onManageInWindows}
								onHide={actions.onHide}
								onDemote={actions.onDemoteAuxiliary}
								chips={
									installed && (
										<span
											className={ROW_CHIP}
											title="A newer version of this program is already installed"
										>
											Installed {installed} is newer
										</span>
									)
								}
								actions={
									<>
										{versionToggle}
										<RowAction
											icon={FolderOpen}
											label="Folder"
											accessibleLabel={`Open the folder of ${app.name}`}
											onClick={() =>
												void actions.onOpenFolder(app)
											}
										/>
									</>
								}
							/>
						)
					}}
				/>
			</div>
		</section>
	)
}
