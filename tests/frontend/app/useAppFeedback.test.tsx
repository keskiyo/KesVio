import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppFeedback } from '../../../src/app/model/useAppFeedback'

const { toastError, toastInfo, toastSuccess } = vi.hoisted(() => ({
	toastError: vi.fn(),
	toastInfo: vi.fn(),
	toastSuccess: vi.fn(),
}))

vi.mock('sonner', () => ({
	toast: {
		error: toastError,
		info: toastInfo,
		success: toastSuccess,
	},
}))

function options(overrides: Partial<Parameters<typeof useAppFeedback>[0]>) {
	return {
		onLaunch: vi.fn().mockResolvedValue(undefined),
		onFullScan: vi.fn().mockResolvedValue(undefined),
		onRefresh: vi.fn().mockResolvedValue(undefined),
		onUndo: vi.fn().mockReturnValue({ ok: true as const }),
		...overrides,
	}
}

describe('useAppFeedback', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('reports typed scan cancellation as informational feedback', async () => {
		const { result } = renderHook(() =>
			useAppFeedback(
				options({
					onRefresh: vi.fn().mockRejectedValue({
						code: 'SCAN_CANCELLED',
						message: 'Application scan cancelled.',
					}),
				}),
			),
		)

		await act(() => result.current.refresh())

		expect(toastInfo).toHaveBeenCalledWith('Application scan cancelled')
		expect(toastError).not.toHaveBeenCalled()
	})

	it('does not infer scan cancellation from an untyped error message', async () => {
		const { result } = renderHook(() =>
			useAppFeedback(
				options({
					onRefresh: vi
						.fn()
						.mockRejectedValue(
							new Error('scan cancelled internally'),
						),
				}),
			),
		)

		await act(() => result.current.refresh())

		expect(toastError).toHaveBeenCalledWith(
			'Could not refresh the application list (INTERNAL)',
		)
		expect(toastInfo).not.toHaveBeenCalled()
	})

	// The scan failures worth diagnosing differ only by code, so the toast carries it: a support
	// request now names OPERATION_INTERRUPTED or SCAN_COALESCED without asking for the log file.
	it('names the backend error code in the failure toast', async () => {
		const { result } = renderHook(() =>
			useAppFeedback(
				options({
					onRefresh: vi.fn().mockRejectedValue({
						code: 'OPERATION_INTERRUPTED',
						message: 'The operation was interrupted. Try again.',
					}),
				}),
			),
		)

		await act(() => result.current.refresh())

		expect(toastError).toHaveBeenCalledWith(
			'Could not refresh the application list (OPERATION_INTERRUPTED)',
		)
	})

	it('confirms an undo and reports a refused one with its safe reason', () => {
		const onUndo = vi
			.fn()
			.mockReturnValueOnce({ ok: true })
			.mockReturnValueOnce({ ok: false, error: 'Nothing to undo' })
		const { result } = renderHook(() => useAppFeedback(options({ onUndo })))

		act(() => result.current.undo())
		expect(toastSuccess).toHaveBeenCalledWith('Undone')

		act(() => result.current.undo())
		expect(toastError).toHaveBeenCalledWith('Nothing to undo')
	})
})
