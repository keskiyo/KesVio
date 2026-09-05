import { emit } from '@tauri-apps/api/event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emitIfTauri } from '../../../../src/shared/api/tauri/client'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(), listen: vi.fn() }))

type TauriTestGlobal = typeof globalThis & {
	__TAURI_INTERNALS__?: unknown
}

describe('emitIfTauri', () => {
	beforeEach(() => {
		delete (globalThis as TauriTestGlobal).__TAURI_INTERNALS__
		vi.mocked(emit).mockReset()
	})

	afterEach(() => {
		delete (globalThis as TauriTestGlobal).__TAURI_INTERNALS__
	})

	it('does not emit outside the desktop runtime', async () => {
		await emitIfTauri<void>('app://frontend-ready')

		expect(emit).not.toHaveBeenCalled()
	})

	it('emits the event without inventing a payload in the desktop runtime', async () => {
		;(globalThis as TauriTestGlobal).__TAURI_INTERNALS__ = {}
		vi.mocked(emit).mockResolvedValue()

		await emitIfTauri<void>('app://frontend-ready')

		expect(emit).toHaveBeenCalledWith('app://frontend-ready', undefined)
	})
})
