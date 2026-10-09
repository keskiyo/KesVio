import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWindowBackdrop } from '../../../src/app/model/useWindowBackdrop'

afterEach(() => {
	delete document.documentElement.dataset.backdrop
})

describe('useWindowBackdrop', () => {
	it('lets the page show the Mica backdrop the window reports', async () => {
		const getWindowBackdrop = vi.fn().mockResolvedValue('mica')
		renderHook(() => useWindowBackdrop({ getWindowBackdrop }))

		await waitFor(() =>
			expect(document.documentElement.dataset.backdrop).toBe('mica'),
		)
	})

	it('keeps the solid page when the window has no Mica', async () => {
		const getWindowBackdrop = vi.fn().mockResolvedValue('solid')
		renderHook(() => useWindowBackdrop({ getWindowBackdrop }))

		await waitFor(() => expect(getWindowBackdrop).toHaveBeenCalled())
		expect(document.documentElement.dataset.backdrop).toBeUndefined()
	})

	it('ignores an unexpected answer and a failed request', async () => {
		const strange = vi.fn().mockResolvedValue('acrylic')
		const { unmount } = renderHook(() =>
			useWindowBackdrop({ getWindowBackdrop: strange }),
		)
		await waitFor(() => expect(strange).toHaveBeenCalled())
		expect(document.documentElement.dataset.backdrop).toBeUndefined()
		unmount()

		const failing = vi.fn().mockRejectedValue(new Error('no runtime'))
		renderHook(() => useWindowBackdrop({ getWindowBackdrop: failing }))
		await waitFor(() => expect(failing).toHaveBeenCalled())
		expect(document.documentElement.dataset.backdrop).toBeUndefined()
	})

	it('does not mark the page after unmounting before the answer', async () => {
		let resolve: (value: 'mica') => void = () => undefined
		const getWindowBackdrop = vi.fn(
			() => new Promise<'mica'>(done => (resolve = done)),
		)
		const { unmount } = renderHook(() =>
			useWindowBackdrop({ getWindowBackdrop }),
		)
		unmount()
		resolve('mica')
		await Promise.resolve()

		expect(document.documentElement.dataset.backdrop).toBeUndefined()
	})
})
