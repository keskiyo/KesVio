import { RotateCcw, SearchX, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
	type AppVisibilityReason,
	auxiliaryReason,
	groupAppVersions,
	sortFavoritesFirst,
	visibilityReasonLabel,
} from '../../../../entities/app'
import type { AuxiliaryGridProps } from '../../types'
import { AppRow } from '../AppRow/AppRow'
import { APP_ROW_GRID, APP_ROW_PAGE, ROW_CHIP } from '../AppRow/data'
import { RowAction } from '../AppRow/RowAction'
import { VersionedRows } from '../AppRow/VersionedRows'
import { CatalogViewHeader } from '../CatalogViewHeader'
import { ViewEmptyState } from '../ViewEmptyState'
import { ReasonFilter } from './ReasonFilter'
import { reasonOptions } from './reasonOptions'

export function AuxiliaryGrid(props: AuxiliaryGridProps) {
	const apps = useMemo(
		() => sortFavoritesFirst(props.apps, props.favoriteAppIds),
		[props.apps, props.favoriteAppIds],
	)
	const options = useMemo(() => reasonOptions(apps), [apps])
	const [chosen, setChosen] = useState<AppVisibilityReason | null>(null)
	const selected = options.some(option => option.reason === chosen)
		? chosen
		: null
	const shown = selected
		? apps.filter(app => auxiliaryReason(app) === selected)
		: apps
	const back = { label: 'Back to More', onBack: props.onBack }
	return (
		<section aria-labelledby="auxiliary-title" className={APP_ROW_PAGE}>
			<CatalogViewHeader
				icon={Wrench}
				title="Auxiliary tools"
				titleId="auxiliary-title"
				count={apps.length}
				noun="tool"
				description="Helper executables discovered by KesVio."
				back={back}
			/>
			{apps.length ? (
				<>
					<ReasonFilter
						options={options}
						total={apps.length}
						selected={selected}
						onSelect={setChosen}
					/>
					<div className={APP_ROW_GRID}>
						<VersionedRows
							groups={groupAppVersions(shown)}
							renderRow={(app, versionToggle) => {
								const reason = auxiliaryReason(app)
								return (
									<AppRow
										app={app}
										categories={props.categories}
										categoryOrder={props.categoryOrder}
										isHidden
										onLaunch={props.onLaunch}
										onMove={props.onMoveApp}
										onInfo={props.onInfo}
										onManageInWindows={
											props.onManageInWindows
										}
										onDemote={props.onDemote}
										chips={
											reason && (
												<span className={ROW_CHIP}>
													{visibilityReasonLabel(
														reason,
													)}
												</span>
											)
										}
										actions={
											<>
												{versionToggle}
												<RowAction
													icon={RotateCcw}
													label="Restore"
													accessibleLabel={`Restore ${app.name} to catalog`}
													onClick={() =>
														props.onPromote(app.id)
													}
												/>
											</>
										}
									/>
								)
							}}
						/>
					</div>
				</>
			) : props.hasQuery ? (
				<ViewEmptyState
					icon={SearchX}
					title="No matching auxiliary tools"
					description="Try a different search."
				/>
			) : (
				<ViewEmptyState
					icon={Wrench}
					title="No auxiliary tools found"
					description="KesVio did not find helper executables in the current catalog."
					back={back}
				/>
			)}
		</section>
	)
}
