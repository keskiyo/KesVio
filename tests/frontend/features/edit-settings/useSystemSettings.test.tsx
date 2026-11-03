import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSystemSettings } from '../../../../src/features/edit-settings/model/useSystemSettings'
import { AppClientError } from '../../../../src/shared/api/tauri/errors'
import { observeScanSettings } from '../../../../src/entities/system/api/observeScanSettings'
import type {
	ScanSettings,
	SystemClient,
	SystemSettings,
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
		startupEntry: 'disabled',
	}),
	setScanSettings: vi.fn(),
	setCloseBehavior: vi.fn().mockImplementation(async value => value),
	setGlobalShortcut: vi.fn().mockResolvedValue({
		available: true,
		label: 'Win+Shift+Q',
		error: null,
	}),
	setStartupEnabled: vi
		.fn()
		.mockImplementation(async enabled =>
			enabled ? 'enabled' : 'disabled',
		),
	savePreferencesBackup: vi.fn(),
	exportDiagnosticsLog: vi.fn().mockResolvedValue(true),
	previewDiagnosticsLog: vi
		.fn()
		.mockResolvedValue('<diagnostics redacted="true" />'),
	pickFolder: vi.fn(),
	openTelegram: vi.fn(),
	openGithub: vi.fn(),
	openAppsSettings: vi.fn(),
}

describe('useSystemSettings', () => {
	it('preserves an observed save when an older initial read resolves later', async () => {
		const snapshot = await client.getSettings()
		let finish: ((value: SystemSettings) => void) | undefined
		const waiting = new Promise<SystemSettings>(resolve => {
			finish = resolve
		})
		const observed = observeScanSettings({
			...client,
			getSettings: () => waiting,
			setScanSettings: async value => value,
		})
		const { result } = renderHook(() =>
			useSystemSettings({ client: observed }),
		)
		await act(() =>
			observed.setScanSettings({
				...scanSettings,
				includedPaths: ['F:\\Apps'],
			}),
		)
		await act(async () => finish?.(snapshot))
		expect(result.current.settings?.scanSettings.includedPaths).toEqual([
			'F:\\Apps',
		])
	})
	it('notifies successful saves, skips failed saves and releases subscriptions', async () => {
		const save = vi.fn().mockResolvedValue(scanSettings)
		const observed = observeScanSettings({
			...client,
			setScanSettings: save,
		})
		const listener = vi.fn()
		const stop = observed.onScanSettingsChanged!(listener)
		await observed.setScanSettings(scanSettings)
		expect(listener).toHaveBeenCalledExactlyOnceWith(scanSettings)
		save.mockRejectedValueOnce(new Error('save failed'))
		await expect(observed.setScanSettings(scanSettings)).rejects.toThrow(
			'save failed',
		)
		expect(listener).toHaveBeenCalledOnce()
		stop()
		await observed.setScanSettings(scanSettings)
		expect(listener).toHaveBeenCalledOnce()
	})
	it('keeps a folder added by another client consumer when editing open settings', async () => {
		const save = vi.fn().mockImplementation(async value => value)
		const observed = observeScanSettings({
			...client,
			setScanSettings: save,
		})
		const { result, unmount } = renderHook(() =>
			useSystemSettings({ client: observed }),
		)
		await waitFor(() => expect(result.current.settings).not.toBeNull())
		await act(() =>
			observed.setScanSettings({
				...scanSettings,
				includedPaths: ['F:\\Apps'],
			}),
		)
		expect(result.current.settings?.scanSettings.includedPaths).toEqual([
			'F:\\Apps',
		])
		await act(() =>
			result.current.saveScanSettings({
				...result.current.settings!.scanSettings,
				autoScanFixedDrives: false,
			}),
		)
		expect(save).toHaveBeenLastCalledWith(
			expect.objectContaining({
				includedPaths: ['F:\\Apps'],
				autoScanFixedDrives: false,
			}),
		)
		unmount()
	})
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

	it('stores the startup state the backend answers, not the one requested', async () => {
		const setStartupEnabled = vi.fn().mockResolvedValue('disabled')
		const { result } = renderHook(() =>
			useSystemSettings({ client: { ...client, setStartupEnabled } }),
		)
		await waitFor(() => expect(result.current.settings).not.toBeNull())

		await act(() => result.current.setStartupEnabled(true))

		expect(setStartupEnabled).toHaveBeenCalledWith(true)
		expect(result.current.settings?.startupEntry).toBe('disabled')
	})

	it('stores the global shortcut status the backend answers', async () => {
		const setGlobalShortcut = vi.fn().mockResolvedValue({
			available: true,
			label: 'Ctrl+Alt+P',
			error: null,
		})
		const shortcutClient = { ...client, setGlobalShortcut }
		const { result } = renderHook(() =>
			useSystemSettings({ client: shortcutClient }),
		)
		await waitFor(() => expect(result.current.settings).not.toBeNull())

		await act(() =>
			result.current.setGlobalShortcut({
				win: false,
				ctrl: true,
				alt: true,
				shift: false,
				key: 'KeyP',
			}),
		)

		expect(result.current.settings?.shortcut.label).toBe('Ctrl+Alt+P')
	})

	it('keeps the old global shortcut when registration fails', async () => {
		const shortcutClient = {
			...client,
			setGlobalShortcut: vi
				.fn()
				.mockRejectedValue(
					new AppClientError(
						'GLOBAL_SHORTCUT_UNAVAILABLE',
						'That shortcut is already in use. Choose another one.',
					),
				),
		}
		const { result } = renderHook(() =>
			useSystemSettings({ client: shortcutClient }),
		)
		await waitFor(() => expect(result.current.settings).not.toBeNull())

		await act(() =>
			result.current.setGlobalShortcut({
				win: true,
				ctrl: false,
				alt: false,
				shift: false,
				key: 'KeyP',
			}),
		)

		expect(result.current.settings?.shortcut.label).toBe('Win+Shift+Q')
		expect(result.current.error).toBe(
			'That shortcut is already in use. Choose another one.',
		)
	})

	it('reports a startup toggle failure under the settings area and keeps the old state', async () => {
		const { result } = renderHook(() =>
			useSystemSettings({
				client: {
					...client,
					setStartupEnabled: vi
						.fn()
						.mockRejectedValue(
							new AppClientError(
								'STARTUP_ENTRY_UPDATE_FAILED',
								'Could not change the startup setting. Try again.',
							),
						),
				},
			}),
		)
		await waitFor(() => expect(result.current.settings).not.toBeNull())

		await act(() => result.current.setStartupEnabled(true))

		expect(result.current.errorArea).toBe('settings')
		expect(result.current.error).toBe(
			'Could not change the startup setting. Try again.',
		)
		expect(result.current.settings?.startupEntry).toBe('disabled')
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
