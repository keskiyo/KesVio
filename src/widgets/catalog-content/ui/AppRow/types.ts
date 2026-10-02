import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppInfo, AppVersionGroup } from '../../../../entities/app'
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
	onManageInWindows(): Promise<void>
	onHide?(id: string): void
	onDemote(id: string): void
	chips?: ReactNode
	actions?: ReactNode
}

export interface RowActionProps {
	icon: LucideIcon
	label: string
	accessibleLabel: string
	onClick(): void
}

export interface VersionedRowsProps {
	groups: AppVersionGroup[]
	renderRow(app: AppInfo, versionToggle: ReactNode): ReactNode
}

export interface VersionToggleProps {
	appName: string
	olderCount: number
	expanded: boolean
	onToggle(): void
}
