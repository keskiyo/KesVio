import type { RefObject } from 'react'
import type { AppView, SavedFilter } from '../../entities/app'
import type {
	AppCategory,
	CategoryDefinition,
	CustomCategoryAccent,
} from '../../entities/category'
import type { UpdatePillProps } from '../../features/update-app'

export type CreateCategoryResult =
	{ ok: true; id: string } | { ok: false; error: string }

export interface SavedFiltersNavigation {
	filters: SavedFilter[]
	activeId: string | null
	onSelect(id: string | null): void
	onCreate(): void
	onDelete(id: string): void
}

export interface AppNavigationProps {
	categoryOrder: AppCategory[]
	categories: CategoryDefinition[]
	counts: Map<AppCategory, number>
	activeView: AppView
	appCount: number
	favoriteCount: number
	favoriteScenarioCount?: number
	savedFilters?: SavedFiltersNavigation
	onSelectView(view: AppView): void
	onSelectCategory(category: AppCategory): void
	onCreateCategory(
		label: string,
	): { ok: true; id: string } | { ok: false; error: string }
	onReorderCategory(active: AppCategory, over: AppCategory): void
}

export interface AppDrawerProps {
	open: boolean
	counts: Map<AppCategory, number>
	categoryOrder: AppCategory[]
	categories: CategoryDefinition[]
	activeView: AppView
	appCount: number
	favoriteCount: number
	favoriteScenarioCount?: number
	savedFilters?: SavedFiltersNavigation
	triggerRef: RefObject<HTMLButtonElement>
	identity: NavigationIdentityDetails
	onGoHome(): void
	onSelectView(view: AppView): void
	onSelectCategory(category: AppCategory): void
	onReorderCategory(active: AppCategory, over: AppCategory): void
	onCreateCategory(label: string): CreateCategoryResult
	onClose(): void
	onExited(): void
}

export interface AppSidebarProps extends AppNavigationProps {
	identity: NavigationIdentityDetails
	onGoHome(): void
}

export interface NavigationIdentityDetails {
	version: string | null
	update: Omit<UpdatePillProps, 'className'> | null
}

export interface NavigationIdentityProps extends NavigationIdentityDetails {
	onGoHome(): void
}

export interface CategoryDragOverlayProps {
	category: AppCategory
	count: number
	label: string
	accent?: CustomCategoryAccent
}

export interface SortableNavigationCategoryProps extends CategoryDragOverlayProps {
	isDragPreviewActive?: boolean
	onSelect(category: AppCategory): void
}

export interface NavigationCategoryDragOptions {
	navigationRef: RefObject<HTMLElement>
	onReorderCategory(active: AppCategory, over: AppCategory): void
}
