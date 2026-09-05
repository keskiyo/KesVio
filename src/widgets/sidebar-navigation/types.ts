import type { RefObject } from 'react'
import type { AppView } from '../../entities/app'
import type {
	AppCategory,
	CategoryDefinition,
	CustomCategoryAccent,
} from '../../entities/category'

export type CreateCategoryResult =
	{ ok: true; id: string } | { ok: false; error: string }

export interface AppNavigationProps {
	categoryOrder: AppCategory[]
	categories: CategoryDefinition[]
	counts: Map<AppCategory, number>
	activeView: AppView
	appCount: number
	favoriteCount: number
	favoriteScenarioCount?: number
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
	triggerRef: RefObject<HTMLButtonElement>
	onGoHome(): void
	onSelectView(view: AppView): void
	onSelectCategory(category: AppCategory): void
	onReorderCategory(active: AppCategory, over: AppCategory): void
	onCreateCategory(label: string): CreateCategoryResult
	onClose(): void
	onExited(): void
}

export interface AppSidebarProps extends AppNavigationProps {
	onGoHome(): void
}

export interface NavigationIdentityProps {
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
