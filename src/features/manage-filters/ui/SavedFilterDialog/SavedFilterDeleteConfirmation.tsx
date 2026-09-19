import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog'

interface SavedFilterDeleteConfirmationProps {
	filterName: string
	onConfirm(): void
	onClose(): void
}

export function SavedFilterDeleteConfirmation({
	filterName,
	onConfirm,
	onClose,
}: SavedFilterDeleteConfirmationProps) {
	return (
		<ConfirmDialog
			label={`Delete ${filterName} filter`}
			title={`Delete ${filterName}?`}
			description="This saved filter will be removed. You can undo this action."
			confirmLabel="Delete filter"
			closeLabel="Close filter deletion"
			onClose={onClose}
			onConfirm={onConfirm}
		/>
	)
}
