import { renderHook } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateFailureNotice } from '../../../src/app/model/useUpdateFailureNotice'
import type { UpdaterState } from '../../../src/features/update-app'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

type Notice = Pick<UpdaterState, 'update' | 'phase' | 'error'>

const systemClient = {
	openGithub: vi.fn().mockResolvedValue(undefined),
	openRelease: vi.fn().mockResolvedValue(undefined),
}

beforeEach(() => {
	vi.mocked(toast.error).mockClear()
	systemClient.openRelease.mockClear()
})

// Without the update dialog the pill has no room for the reason an install failed, so the
// safe message and the manual download path it mentions arrive as a toast.
describe('useUpdateFailureNotice', () => {
	it('announces a failed install once with a way to the release page', () => {
		const failed: Notice = {
			update: { version: '0.5.4' },
			phase: 'failed',
			error: 'Could not download the update.',
		}
		const { rerender } = renderHook(
			(updater: Notice) =>
				useUpdateFailureNotice({ systemClient, updater }),
			{ initialProps: failed },
		)
		rerender({ ...failed })

		expect(toast.error).toHaveBeenCalledOnce()
		const [message, options] = vi.mocked(toast.error).mock.calls[0]
		expect(message).toBe('Could not download the update.')
		const action = options?.action as { label: string; onClick(): void }
		expect(action.label).toBe('Open release')
		action.onClick()
		expect(systemClient.openRelease).toHaveBeenCalledWith('0.5.4')
	})

	it('announces a repeated failure after a retry', () => {
		const failed: Notice = {
			update: { version: '0.5.4' },
			phase: 'failed',
			error: 'Could not download the update.',
		}
		const { rerender } = renderHook(
			(updater: Notice) =>
				useUpdateFailureNotice({ systemClient, updater }),
			{ initialProps: failed },
		)
		rerender({ ...failed, phase: 'downloading', error: null })
		rerender(failed)

		expect(toast.error).toHaveBeenCalledTimes(2)
	})

	it('stays quiet while nothing has failed', () => {
		renderHook(() =>
			useUpdateFailureNotice({
				systemClient,
				updater: {
					update: { version: '0.5.4' },
					phase: 'downloading',
					error: null,
				},
			}),
		)

		expect(toast.error).not.toHaveBeenCalled()
	})
})
