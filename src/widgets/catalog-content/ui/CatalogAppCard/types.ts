import type { AppInfo } from '../../../../entities/app'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../entities/category'
import type { AppFileActions } from '../../../../features/app-actions'

export interface CatalogAppCardProps {
	app: AppInfo
	isFavorite: boolean
	categories: CategoryDefinition[]
	categoryOrder: AppCategory[]
	onToggleFavorite(id: string): void
	onLaunch(app: AppInfo): Promise<void>
	onMove(id: string, category: AppCategory): void
	onInfo(app: AppInfo): void
	onManageInWindows(): Promise<void>
	fileActions: AppFileActions
	isHidden?: boolean
	isAuxiliary?: boolean
	onHide(id: string): void
	onRestore(id: string): void
	onDemote(id: string): void
}
