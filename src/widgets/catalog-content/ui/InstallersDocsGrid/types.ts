import type { LucideIcon } from 'lucide-react'
import type { AppInfo } from '../../../../entities/app'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../entities/category'

export interface InstallersDocsGridProps {
	apps: AppInfo[]
	hasQuery: boolean
	categories: CategoryDefinition[]
	categoryOrder: AppCategory[]
	onBack(): void
	onLaunch(app: AppInfo): Promise<void>
	onMoveApp(id: string, category: AppCategory): void
	onInfo(app: AppInfo): void
	onOpenFolder(app: AppInfo): Promise<void>
	onManageInWindows(): Promise<void>
	onHide(id: string): void
	onRestore(id: string): void
	onDemoteAuxiliary(id: string): void
}

export interface ArtifactSectionProps extends Omit<
	InstallersDocsGridProps,
	'apps' | 'hasQuery' | 'onBack'
> {
	icon: LucideIcon
	title: string
	apps: AppInfo[]
}
