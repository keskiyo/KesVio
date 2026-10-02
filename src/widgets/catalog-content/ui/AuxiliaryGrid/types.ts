import type { AppVisibilityReason } from '../../../../entities/app'

export interface ReasonOption {
	reason: AppVisibilityReason
	count: number
}

export interface ReasonFilterProps {
	options: ReasonOption[]
	total: number
	selected: AppVisibilityReason | null
	onSelect(reason: AppVisibilityReason | null): void
}
