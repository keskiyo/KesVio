import type { SensorDescriptor, SensorOptions } from '@dnd-kit/core'
import type { LucideIcon } from 'lucide-react'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../entities/category'
import type { useNavigationCategoryDrag } from '../../model/useNavigationCategoryDrag'

export type { AppNavigationProps } from '../../types'

export interface SortableCategoryListProps {
	categories: AppCategory[]
	counts: Map<AppCategory, number>
	accents: Map<AppCategory, CategoryDefinition>
	labels: Map<AppCategory, string>
	sensors: SensorDescriptor<SensorOptions>[]
	drag: ReturnType<typeof useNavigationCategoryDrag>
	onSelectCategory(category: AppCategory): void
}

export interface NavItemProps {
	icon: LucideIcon
	label: string
	active: boolean
	count?: number
	secondaryCount?: number
	className?: string
	onClick(): void
}
