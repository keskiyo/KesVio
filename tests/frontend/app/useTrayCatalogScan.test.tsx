import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useTrayCatalogScan } from '../../../src/app/model/useTrayCatalogScan'

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((yes, no) => {
		resolve = yes
		reject = no
	})
	return { promise, resolve, reject }
}

function client() {
	let handler: (() => void) | undefined
	const stop = vi.fn()
	return {
		stop,
		request: () => handler?.(),
		setTrayScanState: vi.fn().mockResolvedValue(undefined),
		onTrayForceFullScan: vi.fn(async (callback: () => void) => {
			handler = callback
			return stop
		}),
	}
}

function Harness(props: Parameters<typeof useTrayCatalogScan>[0]) {
	useTrayCatalogScan(props)
	return null
}

describe('useTrayCatalogScan', () => {
	it('preserves the final idle state when the busy update is delayed', async () => {
		const systemClient = client()
		const busyWrite = deferred<void>()
		let nativeBusy = true
		systemClient.setTrayScanState.mockImplementation(
			async (busy: boolean) => {
				if (busy) await busyWrite.promise
				nativeBusy = busy
			},
		)
		render(
			<Harness
				systemClient={systemClient}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				busy={false}
			/>,
		)
		await waitFor(() => expect(nativeBusy).toBe(false))
		await act(async () => systemClient.request())
		await act(async () => busyWrite.resolve())
		await waitFor(() => expect(nativeBusy).toBe(false))
	})

	it('runs the supplied full scan once and restores the menu after completion', async () => {
		const systemClient = client()
		const scan = deferred<void>()
		const onForceFullScan = vi.fn(() => scan.promise)
		render(<Harness {...{ systemClient, onForceFullScan }} busy={false} />)
		await waitFor(() =>
			expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(
				false,
			),
		)
		act(() => {
			systemClient.request()
			systemClient.request()
		})
		expect(onForceFullScan).toHaveBeenCalledOnce()
		await waitFor(() =>
			expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(
				true,
			),
		)
		await act(async () => scan.resolve())
		expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(false)
		expect(toast.success).toHaveBeenCalledWith(
			'Full application scan finished',
		)
	})

	it('ignores requests while another scan or startup is busy and uses the latest callback', async () => {
		const systemClient = client()
		const first = vi.fn().mockResolvedValue(undefined)
		const second = vi.fn().mockResolvedValue(undefined)
		const { rerender } = render(
			<Harness
				systemClient={systemClient}
				onForceFullScan={first}
				busy
			/>,
		)
		await waitFor(() =>
			expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(
				true,
			),
		)
		act(() => systemClient.request())
		expect(first).not.toHaveBeenCalled()
		rerender(
			<Harness
				systemClient={systemClient}
				onForceFullScan={second}
				busy={false}
			/>,
		)
		await act(async () => systemClient.request())
		expect(second).toHaveBeenCalledOnce()
	})

	it('reports safe failures and enables retry', async () => {
		const systemClient = client()
		const onForceFullScan = vi
			.fn()
			.mockRejectedValue(new Error('private path'))
		render(<Harness {...{ systemClient, onForceFullScan }} busy={false} />)
		await waitFor(() =>
			expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(
				false,
			),
		)
		await act(async () => systemClient.request())
		expect(toast.error).toHaveBeenCalledWith(
			'Could not complete the full application scan',
		)
		expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(false)
		await act(async () => systemClient.request())
		expect(onForceFullScan).toHaveBeenCalledTimes(2)
	})

	it('unsubscribes late registration and ignores callbacks after teardown', async () => {
		const registration = deferred<() => void>()
		let callback: (() => void) | undefined
		const stop = vi.fn()
		const systemClient = {
			setTrayScanState: vi.fn().mockResolvedValue(undefined),
			onTrayForceFullScan: vi.fn((handler: () => void) => {
				callback = handler
				return registration.promise
			}),
		}
		const onForceFullScan = vi.fn().mockResolvedValue(undefined)
		const { unmount } = render(
			<Harness {...{ systemClient, onForceFullScan }} busy={false} />,
		)
		unmount()
		await act(async () => registration.resolve(stop))
		act(() => callback?.())
		expect(stop).toHaveBeenCalledOnce()
		expect(onForceFullScan).not.toHaveBeenCalled()
		expect(systemClient.setTrayScanState).not.toHaveBeenCalledWith(false)
	})

	it('never enables the action when listener registration fails', async () => {
		const systemClient = client()
		systemClient.onTrayForceFullScan.mockRejectedValue(
			new Error('unavailable'),
		)
		render(
			<Harness
				systemClient={systemClient}
				onForceFullScan={vi.fn()}
				busy={false}
			/>,
		)
		await act(async () => {})
		expect(systemClient.setTrayScanState).not.toHaveBeenCalledWith(false)
	})

	it('reports cancellation separately and restores the menu', async () => {
		const systemClient = client()
		const onForceFullScan = vi
			.fn()
			.mockRejectedValue({ code: 'SCAN_CANCELLED', message: 'Cancelled' })
		render(<Harness {...{ systemClient, onForceFullScan }} busy={false} />)
		await waitFor(() =>
			expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(
				false,
			),
		)
		await act(async () => systemClient.request())
		expect(toast.info).toHaveBeenCalledWith('Application scan cancelled')
		expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(false)
	})

	it('does not revive the menu when a pending scan finishes after teardown', async () => {
		const systemClient = client()
		const scan = deferred<void>()
		const { unmount } = render(
			<Harness
				systemClient={systemClient}
				onForceFullScan={() => scan.promise}
				busy={false}
			/>,
		)
		await waitFor(() =>
			expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(
				false,
			),
		)
		act(() => systemClient.request())
		unmount()
		await act(async () => scan.resolve())
		expect(systemClient.stop).toHaveBeenCalledOnce()
		expect(systemClient.setTrayScanState).toHaveBeenLastCalledWith(true)
	})
})
