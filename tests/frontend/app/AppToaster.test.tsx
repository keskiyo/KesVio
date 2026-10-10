import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { toaster } = vi.hoisted(() => ({
	toaster: vi.fn((_props: Record<string, unknown>) => null),
}))
vi.mock('sonner', () => ({ Toaster: toaster }))

import { AppToaster } from '../../../src/app/layout/AppToaster'

// Hidden to the tray, the webview reports `document.hidden`; a notice raised then (a drive
// prompt, a tray-started scenario summary) used to run out its timer before anyone could see it.
describe('AppToaster', () => {
	it('holds notices while the window is hidden', () => {
		render(<AppToaster />)

		expect(toaster.mock.calls[0]?.[0]).toMatchObject({
			pauseWhenPageIsHidden: true,
		})
	})
})
