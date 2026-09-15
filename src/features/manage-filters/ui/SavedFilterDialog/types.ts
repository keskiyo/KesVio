import type { SavedFilter, SavedFilterCriteria } from '../../../../entities/app'

export type SaveFilterResult = { ok: true } | { ok: false; error: string }

export interface SavedFilterDialogProps {
	filter: SavedFilter | null
	publishers: string[]
	onSave(name: string, criteria: SavedFilterCriteria): SaveFilterResult
	onDelete?(): void
	onClose(): void
}

export interface CriteriaFieldsetProps {
	criteria: SavedFilterCriteria
	publishers: string[]
	onChange(criteria: SavedFilterCriteria): void
}
