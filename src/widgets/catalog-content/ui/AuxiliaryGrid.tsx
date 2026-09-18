import { SearchX, Wrench } from 'lucide-react'
import { sortFavoritesFirst } from '../../../entities/app'
import type { AuxiliaryGridProps } from '../types'
import { AppRow } from './AppRow/AppRow'
import { CatalogViewHeader } from './CatalogViewHeader'
import { ViewEmptyState } from './ViewEmptyState'

export function AuxiliaryGrid(props: AuxiliaryGridProps) {
	const apps = sortFavoritesFirst(props.apps, props.favoriteAppIds)
	const back = { label: 'Back to More', onBack: props.onBack }
	return (
		<section aria-labelledby="auxiliary-title">
			<CatalogViewHeader
				icon={Wrench}
				title="Auxiliary tools"
				titleId="auxiliary-title"
				count={apps.length}
				noun="tool"
				description="Helper executables discovered by KesVio."
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
								onRestore={props.onPromote}
								onDemote={props.onDemote}
							/>
						))}
					</div>
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
			</div>
		</section>
	)
}
