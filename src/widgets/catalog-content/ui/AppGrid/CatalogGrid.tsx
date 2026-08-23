import { AuxiliaryGrid } from '../AuxiliaryGrid'
import { FavoritesGrid } from '../FavoritesGrid'
import { HiddenGrid } from '../HiddenGrid'
import { InstallersDocsGrid } from '../InstallersDocsGrid/InstallersDocsGrid'
import { CategoryList } from './CategoryList'
import { EmptyState } from './EmptyState'
import type { AppGridProps } from './types'

export function CatalogGrid(props: AppGridProps) {
	if (props.activeView === 'favorites')
		return (
			<FavoritesGrid
				apps={props.apps}
				hasQuery={props.hasQuery}
				favoriteAppIds={props.favoriteAppIds}
				favoriteScenarios={props.favoriteScenarios}
				categories={props.categories}
				categoryOrder={props.categoryOrder}
				onToggleFavorite={props.onToggleFavorite}
				onLaunch={props.onLaunch}
				onMoveApp={props.onMoveApp}
				onInfo={props.onInfo}
				onUninstall={props.onUninstall}
				onHide={props.onHide}
				onRestore={props.onRestore}
				onDemote={props.onDemoteAuxiliary}
			/>
		)
	if (props.activeView === 'hidden')
		return (
			<HiddenGrid
				apps={props.apps}
				hasQuery={props.hasQuery}
				onBack={props.onBack}
				favoriteAppIds={props.favoriteAppIds}
				categories={props.categories}
				categoryOrder={props.categoryOrder}
				onToggleFavorite={props.onToggleFavorite}
				onLaunch={props.onLaunch}
				onMoveApp={props.onMoveApp}
				onInfo={props.onInfo}
				onUninstall={props.onUninstall}
				onHide={props.onHide}
				onRestore={props.onRestore}
				onDemote={props.onDemoteAuxiliary}
			/>
		)
	if (props.activeView === 'auxiliary')
		return (
			<AuxiliaryGrid
				apps={props.apps}
				hasQuery={props.hasQuery}
				onBack={props.onBack}
				favoriteAppIds={props.favoriteAppIds}
				categories={props.categories}
				categoryOrder={props.categoryOrder}
				onLaunch={props.onLaunch}
				onMoveApp={props.onMoveApp}
				onInfo={props.onInfo}
				onUninstall={props.onUninstall}
				onPromote={props.onPromoteAuxiliary}
				onDemote={props.onDemoteAuxiliary}
			/>
		)
	if (props.activeView === 'installers_docs')
		return <InstallersDocsGrid {...props} />
	if (props.apps.length) return <CategoryList {...props} />
	return <EmptyState hasQuery={props.hasQuery} />
}
