import { describe, expect, it, vi } from 'vitest'

const { invoke, listen } = vi.hoisted(() => ({
	invoke: vi.fn(),
	listen: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen, emit: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))

import { tauriSystemClient } from '../../../../src/entities/system/api/systemClient'

describe('tray scan transport', () => {
	it('sends busy state and connects the unit full-scan event with teardown', async () => {
		vi.stubGlobal('__TAURI_INTERNALS__', {})
		const stop = vi.fn()
		listen.mockResolvedValue(stop)
		invoke.mockResolvedValue(undefined)
		try {
			await tauriSystemClient.setTrayScanState?.(true)
			expect(invoke).toHaveBeenCalledWith('set_tray_scan_state', {
				busy: true,
			})
			const run = vi.fn()
			const unlisten = await tauriSystemClient.onTrayForceFullScan?.(run)
			expect(listen).toHaveBeenCalledWith(
				'tray://force-full-scan',
				expect.any(Function),
			)
			const receive = listen.mock.calls[0]?.[1] as (event: {
				payload: null
			}) => void
			receive({ payload: null })
			expect(run).toHaveBeenCalledOnce()
			unlisten?.()
			expect(stop).toHaveBeenCalledOnce()
		} finally {
			vi.unstubAllGlobals()
		}
	})
})
