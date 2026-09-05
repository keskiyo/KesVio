import { act, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FrontendReadyGate } from '../../../src/app/model/FrontendReadyGate'

describe('FrontendReadyGate', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('signals once after the committed shell survives StrictMode setup', () => {
		const frames: FrameRequestCallback[] = []
		vi.stubGlobal(
			'requestAnimationFrame',
			(callback: FrameRequestCallback) => {
				frames.push(callback)
				return frames.length
			},
		)
		const signal = vi.fn()

		render(
			<StrictMode>
				<FrontendReadyGate signal={signal}>
					<div>Rendered KesVio shell</div>
				</FrontendReadyGate>
			</StrictMode>,
		)

		expect(screen.getByText('Rendered KesVio shell')).toBeInTheDocument()
		expect(signal).not.toHaveBeenCalled()
		act(() => {
			while (frames.length) frames.shift()?.(0)
		})
		expect(signal).toHaveBeenCalledTimes(1)
	})
})
