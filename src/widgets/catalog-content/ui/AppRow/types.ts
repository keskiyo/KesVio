import type { AppInfo } from '../../../../entities/app'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../entities/category'

export interface AppRowProps {
	app: AppInfo
	categories: CategoryDefinition[]
	categoryOrder: AppCategory[]
	isHidden: boolean
	onLaunch(app: AppInfo): Promise<void>
	onMove(id: string, category: AppCategory): void
	onInfo(app: AppInfo): void
	onOpenFolder?(app: AppInfo): Promise<void>
	onManageInWindows(): Promise<void>
	onHide?(id: string): void
	onRestore(id: string): void
	onDemote(id: string): void
}
