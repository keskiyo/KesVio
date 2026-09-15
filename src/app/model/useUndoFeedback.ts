import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { UndoEntry } from '../store/undo'

interface UndoFeedbackOptions {
	undoable: UndoEntry | null
	onUndo(): void
}

export function useUndoFeedback({ undoable, onUndo }: UndoFeedbackOptions) {
	const latest = useRef(onUndo)
	latest.current = onUndo
	const revision = undoable?.revision ?? null
	const label = undoable?.label ?? ''

	useEffect(() => {
		if (revision === null) return
		toast(label, {
			action: { label: 'Undo', onClick: () => latest.current() },
		})
	}, [revision, label])
}
