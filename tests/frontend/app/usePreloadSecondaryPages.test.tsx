import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { preload } = vi.hoisted(() => ({
	preload: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/app/layout/lazyPages', () => ({
	preloadSecondaryPages: preload,
}))

import { usePreloadSecondaryPages } from '../../../src/app/model/usePreloadSecondaryPages'

describe('usePreloadSecondaryPages', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		preload.mockClear()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	it('waits for the catalog before fetching the secondary pages', () => {
		const { rerender } = renderHook(
			({ ready }) => usePreloadSecondaryPages(ready),
			{ initialProps: { ready: false } },
		)
		vi.advanceTimersByTime(5000)
		expect(preload).not.toHaveBeenCalled()

		rerender({ ready: true })
		vi.advanceTimersByTime(1499)
		expect(preload).not.toHaveBeenCalled()
		vi.advanceTimersByTime(1)
		expect(preload).toHaveBeenCalledTimes(1)
	})

	it('drops a pending preload on unmount', () => {
		const { unmount } = renderHook(() => usePreloadSecondaryPages(true))
		unmount()
		vi.advanceTimersByTime(5000)
		expect(preload).not.toHaveBeenCalled()
	})
})
