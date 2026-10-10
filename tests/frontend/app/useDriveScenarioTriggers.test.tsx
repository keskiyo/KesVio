import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../../../src/entities/scenario'

const { toastInfo } = vi.hoisted(() => ({ toastInfo: vi.fn() }))
vi.mock('sonner', () => ({ toast: { info: toastInfo } }))

import { useDriveScenarioTriggers } from '../../../src/app/model/useDriveScenarioTriggers'

const scenarios: Scenario[] = [
	{
		id: 'stick',
		name: 'Stick tools',
		launchIdentities: [],
		closeIdentities: [],
		createdAt: null,
		triggerVolumeId: '1a2b3c4d',
	},
	{
		id: 'desk',
		name: 'Desk',
		launchIdentities: [],
		closeIdentities: [],
		createdAt: null,
	},
]

function listener() {
	let emit: (ids: string[]) => void = () => undefined
	const stop = vi.fn()
	const onVolumesArrived = vi.fn(async (handler: (ids: string[]) => void) => {
		emit = handler
		return stop
	})
	return { onVolumesArrived, stop, emit: (ids: string[]) => emit(ids) }
}

describe('useDriveScenarioTriggers', () => {
	beforeEach(() => toastInfo.mockClear())

	it('offers to run the scenario bound to the drive that arrived', async () => {
		const source = listener()
		const onRun = vi.fn()
		renderHook(() =>
			useDriveScenarioTriggers({
				systemClient: { onVolumesArrived: source.onVolumesArrived },
				scenarios,
				onRun,
			}),
		)
		await vi.waitFor(() =>
			expect(source.onVolumesArrived).toHaveBeenCalled(),
		)

		source.emit(['1A2B3C4D', '9f9f9f9f'])

		expect(toastInfo).toHaveBeenCalledTimes(1)
		const [message, options] = toastInfo.mock.calls[0]
		expect(message).toBe('Drive connected: run Stick tools?')
		options.action.onClick()
		expect(onRun).toHaveBeenCalledWith('stick')
	})

	// KesVio usually sits hidden in the tray when a stick is plugged in; the prompt has to wait
	// for the user instead of timing out unseen, and a reconnect must not stack a second copy.
	it('keeps one waiting prompt per scenario until the user answers', async () => {
		const source = listener()
		renderHook(() =>
			useDriveScenarioTriggers({
				systemClient: { onVolumesArrived: source.onVolumesArrived },
				scenarios,
				onRun: vi.fn(),
			}),
		)
		await vi.waitFor(() =>
			expect(source.onVolumesArrived).toHaveBeenCalled(),
		)

		source.emit(['1a2b3c4d'])
		source.emit(['1a2b3c4d'])

		const [first, second] = toastInfo.mock.calls
		expect(first[1].id).toBe('drive-scenario:stick')
		expect(second[1].id).toBe(first[1].id)
		expect(first[1].duration).toBe(Number.POSITIVE_INFINITY)
	})

	it('runs what the scenario is when the prompt is answered, not when it appeared', async () => {
		const source = listener()
		const before = vi.fn()
		const after = vi.fn()
		const { rerender } = renderHook(
			({ onRun }: { onRun: (id: string) => void }) =>
				useDriveScenarioTriggers({
					systemClient: { onVolumesArrived: source.onVolumesArrived },
					scenarios,
					onRun,
				}),
			{ initialProps: { onRun: before } },
		)
		await vi.waitFor(() =>
			expect(source.onVolumesArrived).toHaveBeenCalled(),
		)
		source.emit(['1a2b3c4d'])

		rerender({ onRun: after })
		toastInfo.mock.calls[0][1].action.onClick()

		expect(before).not.toHaveBeenCalled()
		expect(after).toHaveBeenCalledWith('stick')
	})

	it('stays silent for a drive no scenario waits for', async () => {
		const source = listener()
		renderHook(() =>
			useDriveScenarioTriggers({
				systemClient: { onVolumesArrived: source.onVolumesArrived },
				scenarios,
				onRun: vi.fn(),
			}),
		)
		await vi.waitFor(() =>
			expect(source.onVolumesArrived).toHaveBeenCalled(),
		)

		source.emit(['9f9f9f9f'])

		expect(toastInfo).not.toHaveBeenCalled()
	})

	it('unsubscribes on unmount, also when registration resolves late', async () => {
		const stop = vi.fn()
		let resolve: (value: () => void) => void = () => undefined
		const onVolumesArrived = vi.fn(
			() => new Promise<() => void>(done => (resolve = done)),
		)
		const { unmount } = renderHook(() =>
			useDriveScenarioTriggers({
				systemClient: { onVolumesArrived },
				scenarios,
				onRun: vi.fn(),
			}),
		)
		unmount()
		resolve(stop)
		await vi.waitFor(() => expect(stop).toHaveBeenCalled())
	})
})
