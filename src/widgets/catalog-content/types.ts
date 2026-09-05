import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { AppInfo, AppView, SearchScopeCounts } from '../../entities/app'
import type { AppCategory, CategoryDefinition } from '../../entities/category'
import type { Scenario } from '../../entities/scenario'

export interface SearchScopeArea {
	key: keyof SearchScopeCounts
	view: AppView
	label: string
}

export interface SearchScopeHintProps {
	counts: SearchScopeCounts
	activeView: AppView
	onSelectView(view: AppView): void
}

export interface CatalogViewHeaderProps {
	icon: LucideIcon
	title: string
	titleId: string
	count: number
	noun?: string
	back?: { label: string; onBack(): void }
	action?: ReactNode
}

export interface AuxiliaryGridProps {
	apps: AppInfo[]
	hasQuery: boolean
	favoriteAppIds: string[]
	categories: CategoryDefinition[]
	categoryOrder: AppCategory[]
	onBack(): void
	onLaunch(app: AppInfo): Promise<void>
	onMoveApp(id: string, category: AppCategory): void
	onInfo(app: AppInfo): void
	onManageInWindows(): Promise<void>
	onPromote(id: string): void
	onDemote(id: string): void
}

export interface CatalogGridProps {
	apps: AppInfo[]
	hasQuery: boolean
	favoriteAppIds: string[]
	categories: CategoryDefinition[]
	categoryOrder: AppCategory[]
	onToggleFavorite(id: string): void
	onLaunch(app: AppInfo): Promise<void>
	onMoveApp(id: string, category: AppCategory): void
	onInfo(app: AppInfo): void
	onManageInWindows(): Promise<void>
	onHide(id: string): void
	onRestore(id: string): void
	onDemote(id: string): void
}

export interface FavoriteScenariosPanel {
	scenarios: Scenario[]
	apps: AppInfo[]
	runningId: string | null
	isScenarioRunning: boolean
	onRun(id: string): void
	onToggleFavorite(id: string): void
}

export interface FavoritesGridProps extends CatalogGridProps {
	favoriteScenarios: FavoriteScenariosPanel
}

export interface HiddenGridProps extends CatalogGridProps {
	onBack(): void
}

export interface CategoryHeaderProps {
	category: AppCategory
	label: string
	appCount: number
	collapsed: boolean
	onToggle(): void
	onEdit(): void
}
