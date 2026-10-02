import { EyeOff, RotateCcw, SearchX } from 'lucide-react'
import { useState } from 'react'
import { sortFavoritesFirst } from '../../../entities/app'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import type { HiddenGridProps } from '../types'
import { AppRow } from './AppRow/AppRow'
import { APP_ROW_GRID, APP_ROW_PAGE } from './AppRow/data'
import { RowAction } from './AppRow/RowAction'
import { CatalogViewHeader } from './CatalogViewHeader'
import { ViewEmptyState } from './ViewEmptyState'

const NAMES_SHOWN = 5

function hiddenNamesSummary(names: string[]): string {
	const shown = names.slice(0, NAMES_SHOWN).join(', ')
	const rest = names.length - NAMES_SHOWN
	return rest > 0 ? `${shown} and ${rest} more` : shown
}

export function HiddenGrid(props: HiddenGridProps) {
	const [confirmingRestoreAll, setConfirmingRestoreAll] = useState(false)
	const apps = sortFavoritesFirst(props.apps, props.favoriteAppIds)
	const back = { label: 'Back to More', onBack: props.onBack }
	return (
		<section aria-labelledby="hidden-title" className={APP_ROW_PAGE}>
			<CatalogViewHeader
				icon={EyeOff}
				title="Hidden"
				titleId="hidden-title"
				count={apps.length}
				description="Applications removed from your main catalog."
				back={back}
			/>
			{apps.length > 1 && (
				<div className="mb-3 grid sm:flex">
					<RowAction
						icon={RotateCcw}
						label="Restore all"
						accessibleLabel={`Restore all ${apps.length} apps to catalog`}
						onClick={() => setConfirmingRestoreAll(true)}
					/>
				</div>
			)}
			{confirmingRestoreAll && (
				<ConfirmDialog
					label="Restore all hidden apps"
					title={`Restore all ${apps.length} apps?`}
					description="They return to their categories in the catalog. You can undo this action."
					confirmLabel="Restore all"
					confirmIcon={RotateCcw}
					closeLabel="Close restoring all hidden apps"
					onClose={() => setConfirmingRestoreAll(false)}
					onConfirm={() => {
						setConfirmingRestoreAll(false)
						props.onRestoreAll(apps.map(app => app.id))
					}}
				>
					<p className="text-sm break-words text-(--text-secondary)">
						{hiddenNamesSummary(apps.map(app => app.name))}
					</p>
				</ConfirmDialog>
			)}
			{apps.length ? (
				<div className={APP_ROW_GRID}>
					{apps.map(app => (
						<AppRow
							key={app.id}
							app={app}
							categories={props.categories}
							categoryOrder={props.categoryOrder}
							isHidden
							onLaunch={props.onLaunch}
							onMove={props.onMoveApp}
							onInfo={props.onInfo}
							onManageInWindows={props.onManageInWindows}
							onDemote={props.onDemote}
							actions={
								<RowAction
									icon={RotateCcw}
									label="Restore"
									accessibleLabel={`Restore ${app.name} to catalog`}
									onClick={() => props.onRestore(app.id)}
								/>
							}
						/>
					))}
				</div>
			) : props.hasQuery ? (
				<ViewEmptyState
					icon={SearchX}
					title="No matching hidden apps"
					description="Try a different search."
				/>
			) : (
				<ViewEmptyState
					icon={EyeOff}
					title="Nothing is hidden"
					description="All applications are currently visible in your catalog."
					back={back}
				/>
			)}
		</section>
	)
}
