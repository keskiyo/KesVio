import { describe, expect, it, vi } from 'vitest'
import {
	FRONTEND_READY_EVENT,
	scheduleFrontendReady,
} from '../../../src/app/model/scheduleFrontendReady'

describe('scheduleFrontendReady', () => {
	it('signals once after the second animation frame', () => {
		const frames: FrameRequestCallback[] = []
		const requestFrame = vi.fn((callback: FrameRequestCallback) => {
			frames.push(callback)
			return frames.length
		})
		const signal = vi.fn()

		scheduleFrontendReady(signal, requestFrame)
		expect(signal).not.toHaveBeenCalled()

		frames.shift()?.(0)
		expect(signal).not.toHaveBeenCalled()

		frames.shift()?.(16)
		expect(signal).toHaveBeenCalledTimes(1)
	})

	it('uses the backend startup event name', () => {
		expect(FRONTEND_READY_EVENT).toBe('app://frontend-ready')
	})
})
