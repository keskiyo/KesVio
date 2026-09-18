import { EyeOff, SearchX } from 'lucide-react'
import { sortFavoritesFirst } from '../../../entities/app'
import type { HiddenGridProps } from '../types'
import { AppRow } from './AppRow/AppRow'
import { CatalogViewHeader } from './CatalogViewHeader'
import { ViewEmptyState } from './ViewEmptyState'

export function HiddenGrid(props: HiddenGridProps) {
	const apps = sortFavoritesFirst(props.apps, props.favoriteAppIds)
	const back = { label: 'Back to More', onBack: props.onBack }
	return (
		<section aria-labelledby="hidden-title">
			<CatalogViewHeader
				icon={EyeOff}
				title="Hidden"
				titleId="hidden-title"
				count={apps.length}
				description="Applications removed from your main catalog."
				back={back}
			/>
			<div className="mx-auto max-w-3xl min-[1900px]:max-w-[80rem]">
				{apps.length ? (
					<div className="grid min-w-0 grid-cols-1 gap-2.5 min-[769px]:grid-cols-2 min-[1601px]:grid-cols-3">
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
								onRestore={props.onRestore}
								onDemote={props.onDemote}
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
			</div>
		</section>
	)
}
