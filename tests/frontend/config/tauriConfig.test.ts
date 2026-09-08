import { describe, expect, it } from 'vitest'
import tauriConfig from '../../../src-tauri/tauri.conf.json'

// Tauri applies `width`/`height` to the client area but hands `minWidth`/`minHeight` to Windows as
// ptMinTrackSize, which measures the whole window rect. An undecorated window still carries the
// invisible resize border, so the two settings differ by that frame: 8px per side horizontally and
// 9px at the bottom, measured with GetWindowRect against GetClientRect at 96 DPI. Without the
// compensation a drag shrinks the page below the width the layout is built for.
const FRAME_WIDTH = 16
const FRAME_HEIGHT = 9

describe('Tauri window configuration', () => {
	it('keeps the draggable minimum at the 430px mini-launcher layout', () => {
		const window = tauriConfig.app.windows[0]

		expect(window?.minWidth).toBe(430 + FRAME_WIDTH)
		expect(window?.minHeight).toBe(520 + FRAME_HEIGHT)
	})

	// tao clamps the configured client size against the same number it reports as the window-rect
	// minimum, so a `width` under `minWidth` is silently widened on open. Declaring them equal keeps
	// the configuration honest about the size the window actually gets, and window-state.json wins
	// on any profile that already stored geometry.
	it('opens at its own minimum width instead of a size tao would widen', () => {
		const window = tauriConfig.app.windows[0]

		expect(window?.width).toBe(window?.minWidth)
		expect(window?.height).toBe(740)
		expect(window?.resizable).toBe(true)
		expect(window?.height).toBeGreaterThanOrEqual(window?.minHeight ?? 0)
	})
})
