import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
	folderSizeLabel,
	useFolderSize,
} from '../../../../src/features/view-app-details/model/useFolderSize'

describe('useFolderSize', () => {
	it('measures on request and reports the total', async () => {
		const measureAppFolder = vi
			.fn()
			.mockResolvedValue({ bytes: 2048, files: 3, complete: true })
		const { result } = renderHook(() =>
			useFolderSize('code', { measureAppFolder }),
		)
		expect(measureAppFolder).not.toHaveBeenCalled()

		await act(() => result.current.measure())

		expect(measureAppFolder).toHaveBeenCalledWith('code')
		expect(result.current.label).toBe('2 KB in 3 files')
	})

	it('reports a failure without the backend message', async () => {
		const measureAppFolder = vi.fn().mockRejectedValue(new Error('C:\\x'))
		const { result } = renderHook(() =>
			useFolderSize('code', { measureAppFolder }),
		)

		await act(() => result.current.measure())

		expect(result.current.label).toBe('Could not measure the folder.')
	})

	it('drops an answer that arrives after the dialog moved to another app', async () => {
		let finish: (value: {
			bytes: number
			files: number
			complete: boolean
		}) => void = () => undefined
		const measureAppFolder = vi.fn(
			() => new Promise<never>(resolve => (finish = resolve as never)),
		)
		const { result, rerender } = renderHook(
			({ id }) => useFolderSize(id, { measureAppFolder }),
			{ initialProps: { id: 'code' } },
		)
		let pending: Promise<void> = Promise.resolve()
		act(() => {
			pending = result.current.measure()
		})
		rerender({ id: 'chat' })
		await act(async () => {
			finish({ bytes: 1, files: 1, complete: true })
			await pending
		})

		expect(result.current.label).toBeNull()
	})

	it('says when the total stopped early', () => {
		expect(
			folderSizeLabel({ bytes: 1_048_576, files: 1, complete: false }),
		).toBe('At least 1 MB in 1 file')
	})
})
