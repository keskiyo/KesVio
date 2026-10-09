import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppFeedback } from '../../../src/app/model/useAppFeedback'
import type { AppInfo } from '../../../src/entities/app'

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
		onOpenFolder: vi.fn().mockResolvedValue(undefined),
		onLaunchElevated: vi.fn().mockResolvedValue(undefined),
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

	it('reports a folder that could not be opened without exposing the reason', async () => {
		const { result } = renderHook(() =>
			useAppFeedback(
				options({
					onOpenFolder: vi
						.fn()
						.mockRejectedValue(
							new Error('C:\\Users\\Example\\denied'),
						),
				}),
			),
		)

		await act(() =>
			result.current.openFolder({
				id: 'setup',
				name: 'Setup',
			} as Parameters<typeof result.current.openFolder>[0]),
		)

		expect(toastError).toHaveBeenCalledWith(
			'Could not open the folder of Setup',
		)
		expect(String(toastError.mock.calls[0])).not.toContain('Example')
	})

	const editor = {
		id: 'editor',
		name: 'Editor',
		path: 'C:\\Editor\\editor.exe',
	} as AppInfo

	it('copies a path and confirms it', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText },
		})
		const { result } = renderHook(() => useAppFeedback(options({})))

		await act(() => result.current.fileActions.copyPath(editor))

		expect(writeText).toHaveBeenCalledWith('C:\\Editor\\editor.exe')
		expect(toastSuccess).toHaveBeenCalledWith('Path copied')
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: undefined,
		})
	})

	it('treats a dismissed consent prompt as information, not failure', async () => {
		const { result } = renderHook(() =>
			useAppFeedback(
				options({
					onLaunchElevated: vi.fn().mockRejectedValue({
						code: 'LAUNCH_CANCELLED',
						message: 'The launch was cancelled.',
					}),
				}),
			),
		)

		await act(() => result.current.fileActions.launchElevated!(editor))

		expect(toastInfo).toHaveBeenCalledWith('Launch cancelled')
		expect(toastError).not.toHaveBeenCalled()
	})

	it('reports an elevated launch failure without the backend message', async () => {
		const { result } = renderHook(() =>
			useAppFeedback(
				options({
					onLaunchElevated: vi
						.fn()
						.mockRejectedValue(new Error('C:\\private\\path')),
				}),
			),
		)

		await act(() => result.current.fileActions.launchElevated!(editor))

		expect(toastError).toHaveBeenCalledWith(
			'Could not launch Editor as administrator',
		)
	})

	it('asks Windows once per app and retries only after a failed answer', async () => {
		const onCanLaunchElevated = vi
			.fn()
			.mockRejectedValueOnce(new Error('busy'))
			.mockResolvedValue(true)
		const { result } = renderHook(() =>
			useAppFeedback(options({ onCanLaunchElevated })),
		)
		const ask = result.current.fileActions.canLaunchElevated!

		await expect(ask(editor)).resolves.toBe(false)
		await expect(ask(editor)).resolves.toBe(true)
		await expect(ask(editor)).resolves.toBe(true)

		expect(onCanLaunchElevated).toHaveBeenCalledTimes(2)
	})

	it('offers no elevated launch when the client has none', () => {
		const { result } = renderHook(() =>
			useAppFeedback(options({ onLaunchElevated: undefined })),
		)
		expect(result.current.fileActions.launchElevated).toBeUndefined()
	})
})
