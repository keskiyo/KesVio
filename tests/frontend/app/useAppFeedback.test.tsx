import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppFeedback } from '../../../src/app/model/useAppFeedback'

const { toastError, toastInfo } = vi.hoisted(() => ({
	toastError: vi.fn(),
	toastInfo: vi.fn(),
}))

vi.mock('sonner', () => ({
	toast: {
		error: toastError,
		info: toastInfo,
		success: vi.fn(),
	},
}))

describe('useAppFeedback', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('reports typed scan cancellation as informational feedback', async () => {
		const { result } = renderHook(() =>
			useAppFeedback({
				onLaunch: vi.fn().mockResolvedValue(undefined),
				onRefresh: vi.fn().mockRejectedValue({
					code: 'SCAN_CANCELLED',
					message: 'Application scan cancelled.',
				}),
			}),
		)

		await act(() => result.current.refresh())

		expect(toastInfo).toHaveBeenCalledWith('Application scan cancelled')
		expect(toastError).not.toHaveBeenCalled()
	})

	it('does not infer scan cancellation from an untyped error message', async () => {
		const { result } = renderHook(() =>
			useAppFeedback({
				onLaunch: vi.fn().mockResolvedValue(undefined),
				onRefresh: vi
					.fn()
					.mockRejectedValue(new Error('scan cancelled internally')),
			}),
		)

		await act(() => result.current.refresh())

		expect(toastError).toHaveBeenCalledWith(
			'Could not refresh the application list',
		)
		expect(toastInfo).not.toHaveBeenCalled()
	})
})
