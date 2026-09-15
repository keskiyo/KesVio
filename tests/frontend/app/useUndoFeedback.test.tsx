import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUndoFeedback } from '../../../src/app/model/useUndoFeedback'
import type { UndoEntry } from '../../../src/app/store/undo'

const { toastFn } = vi.hoisted(() => ({ toastFn: vi.fn() }))

vi.mock('sonner', () => ({ toast: toastFn }))

function entry(label: string, revision: number): UndoEntry {
	return {
		label,
		revision,
		patch: {
			lists: {},
			records: {},
			categories: [],
			scenarios: [],
			savedFilters: [],
		},
	}
}

describe('useUndoFeedback', () => {
	beforeEach(() => {
		toastFn.mockClear()
	})

	// Every undoable change announces itself once, with the undo on the toast; undoing clears
	// the entry and must not announce anything, and the action always reaches the latest undo.
	it('announces each new change with an Undo action and stays quiet after an undo', () => {
		const first = vi.fn()
		const second = vi.fn()
		const initialProps: Parameters<typeof useUndoFeedback>[0] = {
			undoable: null,
			onUndo: first,
		}
		const { rerender } = renderHook(
			(props: Parameters<typeof useUndoFeedback>[0]) =>
				useUndoFeedback(props),
			{ initialProps },
		)
		expect(toastFn).not.toHaveBeenCalled()

		rerender({ undoable: entry('Hid Git', 1), onUndo: first })
		expect(toastFn).toHaveBeenCalledTimes(1)
		expect(toastFn).toHaveBeenLastCalledWith('Hid Git', {
			action: { label: 'Undo', onClick: expect.any(Function) },
		})

		rerender({ undoable: entry('Hid Git', 1), onUndo: second })
		expect(toastFn).toHaveBeenCalledTimes(1)
		const action = toastFn.mock.calls[0][1].action as { onClick(): void }
		action.onClick()
		expect(second).toHaveBeenCalledOnce()
		expect(first).not.toHaveBeenCalled()

		rerender({ undoable: null, onUndo: second })
		expect(toastFn).toHaveBeenCalledTimes(1)

		rerender({ undoable: entry('Moved Git to Games', 2), onUndo: second })
		expect(toastFn).toHaveBeenCalledTimes(2)
	})
})
