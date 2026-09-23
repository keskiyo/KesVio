import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNavigationIdentity } from '../../../src/app/model/useNavigationIdentity'
import type { SystemSettings } from '../../../src/entities/system'
import type { UpdaterState } from '../../../src/features/update-app'

function settings(version: string) {
	return { version } as SystemSettings
}

function updater(
	overrides: Partial<
		Pick<UpdaterState, 'update' | 'phase' | 'progress' | 'install'>
	> = {},
) {
	return {
		update: null,
		phase: 'idle' as const,
		progress: null,
		install: vi.fn().mockResolvedValue(undefined),
		...overrides,
	}
}

describe('useNavigationIdentity', () => {
	it('reads the running version once across renders', async () => {
		const getSettings = vi.fn().mockResolvedValue(settings('0.5.3'))
		const state = updater()
		const { result, rerender } = renderHook(() =>
			useNavigationIdentity({
				systemClient: { getSettings },
				updater: state,
			}),
		)

		await waitFor(() => expect(result.current.version).toBe('0.5.3'))
		rerender()
		expect(result.current.version).toBe('0.5.3')
		expect(getSettings).toHaveBeenCalledOnce()
	})

	it('keeps the version empty when the settings cannot be read', async () => {
		const getSettings = vi.fn().mockRejectedValue(new Error('unavailable'))
		const state = updater()
		const { result } = renderHook(() =>
			useNavigationIdentity({
				systemClient: { getSettings },
				updater: state,
			}),
		)

		await waitFor(() => expect(getSettings).toHaveBeenCalled())
		expect(result.current.version).toBeNull()
	})

	it('ignores a version that arrives after unmount', async () => {
		let resolve: (value: SystemSettings) => void = () => {}
		const getSettings = vi.fn(
			() => new Promise<SystemSettings>(done => (resolve = done)),
		)
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		const state = updater()
		const { unmount } = renderHook(() =>
			useNavigationIdentity({
				systemClient: { getSettings },
				updater: state,
			}),
		)

		unmount()
		resolve(settings('0.5.3'))
		await Promise.resolve()
		expect(error).not.toHaveBeenCalled()
		error.mockRestore()
	})

	it('hands the install state to the update action and installs on request', async () => {
		const install = vi.fn().mockResolvedValue(undefined)
		const state = updater({
			update: { version: '0.5.4' },
			phase: 'downloading',
			progress: 42,
			install,
		})
		const { result } = renderHook(() =>
			useNavigationIdentity({
				systemClient: {
					getSettings: vi.fn().mockResolvedValue(settings('0.5.3')),
				},
				updater: state,
			}),
		)

		expect(result.current.update).toMatchObject({
			version: '0.5.4',
			phase: 'downloading',
			progress: 42,
		})
		result.current.update?.onInstall()
		expect(install).toHaveBeenCalledOnce()
		await waitFor(() => expect(result.current.version).toBe('0.5.3'))
	})
})
