import { renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useShortcutNotice } from '../../../src/app/model/useShortcutNotice'
import type {
	GlobalShortcutStatus,
	SystemSettings,
} from '../../../src/entities/system'

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

function client(shortcut: GlobalShortcutStatus) {
	return {
		getSettings: vi
			.fn()
			.mockResolvedValue({ shortcut } as unknown as SystemSettings),
	}
}

beforeEach(() => {
	vi.mocked(toast.warning).mockClear()
})

// A shortcut Windows refused at sign-in used to fail silently: the only trace was a line deep
// in Settings, so the user just found the hotkey dead.
describe('useShortcutNotice', () => {
	it('warns once when Windows refused the saved shortcut and offers Settings', async () => {
		const selectView = vi.fn()
		const systemClient = client({
			available: false,
			pending: false,
			label: 'Ctrl+Alt+P',
			error: 'The shortcut could not be registered.',
		})

		renderHook(() => useShortcutNotice({ systemClient, selectView }))

		await waitFor(() => expect(toast.warning).toHaveBeenCalledOnce())
		const [message, options] = vi.mocked(toast.warning).mock.calls[0]
		expect(message).toBe(
			'Ctrl+Alt+P is not active — Windows or another app already uses it.',
		)
		const action = options?.action as { label: string; onClick(): void }
		expect(action.label).toBe('Choose another')
		action.onClick()
		expect(selectView).toHaveBeenCalledWith('settings')
	})

	it('stays quiet while the shortcut works', async () => {
		const systemClient = client({
			available: true,
			pending: false,
			label: 'Win+Shift+Q',
			error: null,
		})

		renderHook(() =>
			useShortcutNotice({ systemClient, selectView: vi.fn() }),
		)

		await waitFor(() => expect(systemClient.getSettings).toHaveBeenCalled())
		expect(toast.warning).not.toHaveBeenCalled()
	})

	it('never raises a false alarm while registration is still pending', async () => {
		const systemClient = client({
			available: false,
			pending: true,
			label: 'Win+Shift+Q',
			error: 'The shortcut has not been registered yet.',
		})

		renderHook(() =>
			useShortcutNotice({ systemClient, selectView: vi.fn() }),
		)

		await waitFor(() => expect(systemClient.getSettings).toHaveBeenCalled())
		expect(toast.warning).not.toHaveBeenCalled()
	})

	it('ignores a settings answer that arrives after unmount', async () => {
		let resolve: (settings: SystemSettings) => void = () => undefined
		const systemClient = {
			getSettings: vi.fn(
				() =>
					new Promise<SystemSettings>(done => {
						resolve = done
					}),
			),
		}

		const view = renderHook(() =>
			useShortcutNotice({ systemClient, selectView: vi.fn() }),
		)
		view.unmount()
		resolve({
			shortcut: {
				available: false,
				pending: false,
				label: 'Win+Shift+Q',
				error: 'refused',
			},
		} as unknown as SystemSettings)
		await Promise.resolve()

		expect(toast.warning).not.toHaveBeenCalled()
	})
})
