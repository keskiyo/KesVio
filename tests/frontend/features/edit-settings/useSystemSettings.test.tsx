import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSystemSettings } from '../../../../src/features/edit-settings/model/useSystemSettings'
import { AppClientError } from '../../../../src/shared/api/tauri/errors'
import type {
	ScanSettings,
	SystemClient,
} from '../../../../src/entities/system'

const scanSettings: ScanSettings = {
	autoScanFixedDrives: true,
	includedPaths: [],
	excludedPaths: [],
}

const client: SystemClient = {
	getSettings: vi.fn().mockResolvedValue({
		version: '0.2.4',
		shortcut: { available: true, label: 'Win+Shift+Q', error: null },
		scanSettings: {
			autoScanFixedDrives: true,
			includedPaths: [],
			excludedPaths: [],
		},
		fixedDrives: ['C:\\'],
		hideToTrayOnClose: true,
	}),
	setScanSettings: vi.fn(),
	setCloseBehavior: vi.fn().mockImplementation(async value => value),
	getUninstallHistory: vi.fn().mockResolvedValue([]),
	clearUninstallHistory: vi.fn(),
	savePreferencesBackup: vi.fn(),
	exportDiagnosticsLog: vi.fn().mockResolvedValue(true),
	pickFolder: vi.fn(),
	openTelegram: vi.fn(),
	openGithub: vi.fn(),
	openAppsSettings: vi.fn(),
}

describe('useSystemSettings', () => {
	it('does not expose settings failure internals', async () => {
		const { result } = renderHook(() =>
			useSystemSettings({
				client: {
					...client,
					getSettings: vi
						.fn()
						.mockRejectedValue(
							new Error(
								'C:\\Users\\Example\\private-settings-detail',
							),
						),
				},
			}),
		)

		await waitFor(() =>
			expect(result.current.error).toBe(
				'The operation could not be completed. Try again.',
			),
		)
	})

	// One shared error line at the bottom of the page left the user hunting for which control
	// failed; the area lets the page put the message under the section that produced it.
	it('reports which settings area produced the failure', async () => {
		const { result } = renderHook(() =>
			useSystemSettings({
				client: {
					...client,
					setScanSettings: vi
						.fn()
						.mockRejectedValue(
							new AppClientError('INTERNAL', 'Discovery denied.'),
						),
				},
			}),
		)
		await waitFor(() => expect(result.current.settings).not.toBeNull())

		await act(() => result.current.saveScanSettings(scanSettings))

		expect(result.current.error).toBe('Discovery denied.')
		expect(result.current.errorArea).toBe('discovery')
	})

	// A stale message used to survive under a later successful action.
	it('clears an earlier failure once a later save succeeds', async () => {
		const setScanSettings = vi
			.fn()
			.mockRejectedValueOnce(new AppClientError('INTERNAL', 'Denied.'))
			.mockImplementation(async value => value)
		const { result } = renderHook(() =>
			useSystemSettings({ client: { ...client, setScanSettings } }),
		)
		await waitFor(() => expect(result.current.settings).not.toBeNull())

		await act(() => result.current.saveScanSettings(scanSettings))
		expect(result.current.error).toBe('Denied.')

		await act(() => result.current.saveScanSettings(scanSettings))

		expect(result.current.error).toBeNull()
	})

	it('allows only one catalog maintenance operation at a time', async () => {
		let finishForce: (() => void) | undefined
		const force = vi.fn(
			() =>
				new Promise<void>(resolve => {
					finishForce = resolve
				}),
		)
		const reset = vi.fn().mockResolvedValue(undefined)
		const { result } = renderHook(() =>
			useSystemSettings({
				client,
				onForceFullScan: force,
				onResetCatalogCache: reset,
			}),
		)

		let forcing: Promise<void>
		let resetting: Promise<void>
		act(() => {
			forcing = result.current.forceFullScan()
			resetting = result.current.resetCatalogCache()
		})
		expect(force).toHaveBeenCalledOnce()
		expect(reset).not.toHaveBeenCalled()
		finishForce?.()
		await act(async () => Promise.all([forcing, resetting]))
	})

	it.each(['force', 'reset'] as const)(
		'does not expose %s scan cancellation as a settings error',
		async operation => {
			const cancellation = new AppClientError(
				'SCAN_CANCELLED',
				'Application scan cancelled.',
			)
			const { result } = renderHook(() =>
				useSystemSettings({
					client,
					onForceFullScan: vi.fn().mockRejectedValue(cancellation),
					onResetCatalogCache: vi
						.fn()
						.mockRejectedValue(cancellation),
				}),
			)

			await act(() =>
				operation === 'force'
					? result.current.forceFullScan()
					: result.current.resetCatalogCache(),
			)

			expect(result.current.error).toBeNull()
		},
	)
})
