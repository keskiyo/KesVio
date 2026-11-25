import { AuxiliaryGrid } from '../AuxiliaryGrid/AuxiliaryGrid'
import { FavoritesGrid } from '../FavoritesGrid/FavoritesGrid'
import { HiddenGrid } from '../HiddenGrid'
import { InstallersDocsGrid } from '../InstallersDocsGrid/InstallersDocsGrid'
import { CategoryList } from './CategoryList'
import { EmptyState } from './EmptyState'
import type { AppGridProps } from './types'

export function CatalogGrid(props: AppGridProps & { emptySearch?: ReactNode }) {
	if (props.activeView === 'favorites')
		return (
			<FavoritesGrid
				apps={props.apps}
				hasQuery={props.hasQuery}
				emptySearch={props.emptySearch}
				favoriteAppIds={props.favoriteAppIds}
				favoriteScenarios={props.favoriteScenarios}
				categories={props.categories}
				categoryOrder={props.categoryOrder}
				onToggleFavorite={props.onToggleFavorite}
				onLaunch={props.onLaunch}
				onMoveApp={props.onMoveApp}
				onInfo={props.onInfo}
				onManageInWindows={props.onManageInWindows}
				fileActions={props.fileActions}
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
				emptySearch={props.emptySearch}
				onBack={props.onBack}
				favoriteAppIds={props.favoriteAppIds}
				categories={props.categories}
				categoryOrder={props.categoryOrder}
				onToggleFavorite={props.onToggleFavorite}
				onLaunch={props.onLaunch}
				onMoveApp={props.onMoveApp}
				onInfo={props.onInfo}
				onManageInWindows={props.onManageInWindows}
				fileActions={props.fileActions}
				onHide={props.onHide}
				onRestore={props.onRestore}
				onRestoreAll={props.onRestoreAll}
				onDemote={props.onDemoteAuxiliary}
			/>
		)
	if (props.activeView === 'auxiliary')
		return (
			<AuxiliaryGrid
				apps={props.apps}
				hasQuery={props.hasQuery}
				emptySearch={props.emptySearch}
				onBack={props.onBack}
				favoriteAppIds={props.favoriteAppIds}
				categories={props.categories}
				categoryOrder={props.categoryOrder}
				onLaunch={props.onLaunch}
				onMoveApp={props.onMoveApp}
				onInfo={props.onInfo}
				onManageInWindows={props.onManageInWindows}
				fileActions={props.fileActions}
				onPromote={props.onPromoteAuxiliary}
				onDemote={props.onDemoteAuxiliary}
			/>
		)
	if (props.activeView === 'installers_docs')
		return <InstallersDocsGrid {...props} />
	if (props.apps.length) return <CategoryList {...props} />
	return props.emptySearch ?? <EmptyState hasQuery={props.hasQuery} />
}
import type { ReactNode } from 'react'
