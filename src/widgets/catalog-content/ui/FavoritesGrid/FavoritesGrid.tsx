import { Star } from 'lucide-react'
import { useMemo } from 'react'
import { sortFavoritesFirst } from '../../../../entities/app'
import { FavoriteScenarioList } from '../../../../features/manage-scenarios'
import { SectionHeading } from '../../../../shared/ui/SectionHeading'
import type { FavoritesGridProps } from '../../types'
import { CatalogAppCard } from '../CatalogAppCard/CatalogAppCard'
import { CatalogViewHeader } from '../CatalogViewHeader'

export function FavoritesGrid({
	apps,
	hasQuery,
	favoriteAppIds,
	categories,
	categoryOrder,
	favoriteScenarios,
	onToggleFavorite,
	onLaunch,
	onMoveApp,
	onInfo,
	onManageInWindows,
	onHide,
	onRestore,
	onDemote,
}: FavoritesGridProps) {
	const ordered = useMemo(
		() => sortFavoritesFirst(apps, favoriteAppIds),
		[apps, favoriteAppIds],
	)
	const scenarioCount = favoriteScenarios.scenarios.length

	if (!apps.length && !scenarioCount)
		return (
			<section className="grid min-h-[55vh] place-items-center text-center">
				<div>
					<Star
						className="mx-auto mb-4"
						size={38}
						aria-hidden="true"
					/>
					<h2 className="text-lg font-semibold">
						{hasQuery
							? 'No matching favorites'
							: 'No favorites yet'}
					</h2>
					<p className="mt-2 text-sm text-(--text-muted)">
						{hasQuery
							? 'Try a different search.'
							: 'Use the star on an app or scenario card to add it here.'}
					</p>
				</div>
			</section>
		)
	return (
		<section aria-labelledby="favorites-title">
			<CatalogViewHeader
				icon={Star}
				title="Favorites"
				titleId="favorites-title"
				count={apps.length}
				noun="application"
				secondaryCount={
					scenarioCount
						? { count: scenarioCount, noun: 'scenario' }
						: undefined
				}
			/>
			<FavoriteScenarioList {...favoriteScenarios} />
			<section
				aria-labelledby="favorite-applications-title"
				className="favorites-dock"
			>
				<SectionHeading
					title="Applications"
					titleId="favorite-applications-title"
				/>
				{ordered.length ? (
					<div className="app-card-grid">
						{ordered.map(app => (
							<CatalogAppCard
								key={app.id}
								app={app}
								isFavorite={favoriteAppIds.includes(app.id)}
								categories={categories}
								categoryOrder={categoryOrder}
								onToggleFavorite={onToggleFavorite}
								onLaunch={onLaunch}
								onMove={onMoveApp}
								onInfo={onInfo}
								onManageInWindows={onManageInWindows}
								onHide={onHide}
								onRestore={onRestore}
								onDemote={onDemote}
							/>
						))}
					</div>
				) : (
					<p className="text-sm text-(--text-muted)">
						{hasQuery
							? 'No matching favorite apps.'
							: 'Use the star on an app card to add apps here.'}
					</p>
				)}
			</section>
		</section>
	)
}
