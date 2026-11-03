import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { SystemClient } from '../../../src/entities/system'

const { info, dismiss, error } = vi.hoisted(() => ({
	info: vi.fn(),
	dismiss: vi.fn(),
	error: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { info, dismiss, error } }))
import { useDriveScanOffers } from '../../../src/app/model/useDriveScanOffers'

beforeEach(() => vi.clearAllMocks())

it('offers an already connected drive and saves the chosen folder before refreshing', async () => {
	const client = {
		getUntrackedRemovableDrives: vi
			.fn()
			.mockResolvedValue([{ id: '12345678', letter: 'F', label: 'USB' }]),
		onVolumesChanged: vi.fn().mockResolvedValue(vi.fn()),
		pickFolder: vi.fn().mockResolvedValue('F:\\Apps'),
		getSettings: vi.fn().mockResolvedValue({
			scanSettings: {
				autoScanFixedDrives: false,
				includedPaths: [],
				excludedPaths: [],
			},
		}),
		setScanSettings: vi.fn().mockResolvedValue({}),
	} as unknown as SystemClient
	const refresh = vi.fn().mockResolvedValue(undefined)
	renderHook(() => useDriveScanOffers(client, refresh))
	await waitFor(() => expect(info).toHaveBeenCalledOnce())
	expect(info.mock.calls[0]![1].closeButton).toBe(false)
	info.mock.calls[0]![1].action.onClick()
	await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
	expect(client.setScanSettings).toHaveBeenCalledWith(
		expect.objectContaining({ includedPaths: ['F:\\Apps'] }),
	)
})

it('explains how to scan later when the offer is declined', async () => {
	const client = {
		getUntrackedRemovableDrives: vi
			.fn()
			.mockResolvedValue([{ id: '12345678', letter: 'F', label: 'USB' }]),
		onVolumesChanged: vi.fn().mockResolvedValue(vi.fn()),
	} as unknown as SystemClient
	renderHook(() => useDriveScanOffers(client, vi.fn()))
	await waitFor(() => expect(info).toHaveBeenCalledOnce())
	info.mock.calls[0]![1].cancel.onClick()
	expect(info).toHaveBeenLastCalledWith(
		expect.stringContaining('Settings → Catalog'),
	)
})

it('removes a disconnected offer and offers the drive again after reconnection', async () => {
	let changed = () => {}
	const drives = vi
		.fn()
		.mockResolvedValue([{ id: '12345678', letter: 'F', label: 'USB' }])
	const client = {
		getUntrackedRemovableDrives: drives,
		onVolumesChanged: vi.fn(async (handler: () => void) => {
			changed = handler
			return vi.fn()
		}),
	} as unknown as SystemClient
	const refresh = vi.fn().mockResolvedValue(undefined)
	renderHook(() => useDriveScanOffers(client, refresh))
	await waitFor(() => expect(info).toHaveBeenCalledTimes(1))
	drives.mockResolvedValueOnce([])
	changed()
	await waitFor(() =>
		expect(dismiss).toHaveBeenCalledWith('drive-scan:12345678'),
	)
	changed()
	await waitFor(() => expect(info).toHaveBeenCalledTimes(2))
})
