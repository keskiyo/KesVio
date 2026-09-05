import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '../../../../src/pages/settings/ui/SettingsPage'
import type { UpdaterState } from '../../../../src/features/update-app'
import type { SystemClient } from '../../../../src/entities/system'

async function openAdvancedSettings() {
	await userEvent.click(screen.getByRole('button', { name: /Advanced/ }))
}

describe('SettingsPage', () => {
	const settings = {
		version: '0.1.0',
		shortcut: { available: true, label: 'Win+Shift+Q', error: null },
		scanSettings: {
			autoScanFixedDrives: true,
			includedPaths: [],
			excludedPaths: [],
		},
		fixedDrives: ['C:\\'],
		hideToTrayOnClose: true,
	}

	const systemClient = (): SystemClient => ({
		getSettings: vi.fn().mockResolvedValue(settings),
		setScanSettings: vi.fn().mockImplementation(async value => value),
		setCloseBehavior: vi.fn().mockImplementation(async value => value),
		savePreferencesBackup: vi.fn().mockResolvedValue(true),
		exportDiagnosticsLog: vi.fn().mockResolvedValue(true),
		pickFolder: vi.fn().mockResolvedValue(null),
		openTelegram: vi.fn().mockResolvedValue(undefined),
		openGithub: vi.fn().mockResolvedValue(undefined),
		openAppsSettings: vi.fn().mockResolvedValue(undefined),
		openStartupSettings: vi.fn().mockResolvedValue(undefined),
	})

	const updaterState = (
		overrides: Partial<UpdaterState> = {},
	): UpdaterState => ({
		update: null,
		installing: false,
		progress: null,
		downloadedBytes: 0,
		totalBytes: null,
		phase: 'idle',
		error: null,
		status: 'idle',
		checkNow: vi.fn().mockResolvedValue(undefined),
		install: vi.fn().mockResolvedValue(undefined),
		dismiss: vi.fn(),
		...overrides,
	})

	it('opens the Windows installed apps settings page', async () => {
		const client = systemClient()
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)
		await screen.findByText('Version 0.1.0')

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Open Windows installed apps',
			}),
		)

		expect(client.openAppsSettings).toHaveBeenCalledTimes(1)
	})

	it('opens Windows startup management without a runtime startup switch', async () => {
		const client = systemClient()
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		expect(
			screen.queryByRole('switch', {
				name: 'Launch when Windows starts',
			}),
		).not.toBeInTheDocument()
		await userEvent.click(
			screen.getByRole('button', { name: 'Manage startup in Windows' }),
		)
		expect(client.openStartupSettings).toHaveBeenCalledOnce()
	})

	it('orders the compact General Settings sections by task', async () => {
		render(
			<SettingsPage
				density="compact"
				onSetDensity={vi.fn()}
				client={systemClient()}
				updater={updaterState()}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		const sections = [
			'Appearance',
			'Startup & window',
			'System',
			'Updates & links',
		].map(label => screen.getByText(label))

		for (let index = 1; index < sections.length; index += 1) {
			expect(
				sections[index - 1]?.compareDocumentPosition(sections[index]!),
			).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
		}
	})

	it('uses concise descriptions for settings actions', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={systemClient()}
				updater={updaterState()}
				onExportPreferences={() => '{}'}
				onValidatePreferencesImport={() => ({ ok: true })}
				onImportPreferences={() => ({ ok: true })}
				onRestorePreferencesBackup={() => ({ ok: true })}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')

		for (const description of [
			'Works in any keyboard layout.',
			'Open Windows Settings.',
		]) {
			expect(screen.getByText(description)).toBeInTheDocument()
		}

		await openAdvancedSettings()

		for (const description of [
			'Choose where AppNook scans.',
			'Export or import your settings.',
			'Rebuild the application catalog.',
			'Export recent scan logs.',
		]) {
			expect(screen.getByText(description)).toBeInTheDocument()
		}
	})

	// Both sentences are guarantees the code keeps and the reader cannot otherwise check: the
	// history holds no commands or paths, and a refresh does not walk the disk. Shortening the
	// section descriptions once removed them, which is what this case is here to catch.
	it('keeps the privacy and scan-scope guarantees on the page', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		for (const guarantee of [
			'Fixed drives are walked only during Force full scan. An ordinary refresh reads Windows sources and the folders added below.',
			'The log names the folders a scan walked, so read it before sharing it.',
		]) {
			expect(screen.getByText(guarantee)).toBeVisible()
		}
	})

	it('turns the tray behaviour off through the backend and reflects the answer', async () => {
		const client = systemClient()
		client.setCloseBehavior = vi.fn().mockResolvedValue(false)
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		const toggle = screen.getByRole('switch', {
			name: 'Keep running in the tray when the window is closed',
		})
		expect(toggle).toBeChecked()

		await userEvent.click(toggle)

		expect(client.setCloseBehavior).toHaveBeenCalledWith(false)
		expect(
			await screen.findByRole('switch', {
				name: 'Keep running in the tray when the window is closed',
			}),
		).not.toBeChecked()
		expect(
			screen.getByText('Closing the window quits AppNook.'),
		).toBeInTheDocument()
	})

	it('keeps the tray toggle on when the backend refuses to store the change', async () => {
		const client = systemClient()
		client.setCloseBehavior = vi
			.fn()
			.mockRejectedValue(new Error('disk full'))
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)
		await screen.findByText('Version 0.1.0')

		await userEvent.click(
			screen.getByRole('switch', {
				name: 'Keep running in the tray when the window is closed',
			}),
		)

		expect(
			screen.getByRole('switch', {
				name: 'Keep running in the tray when the window is closed',
			}),
		).toBeChecked()
		expect(await screen.findByRole('alert')).toBeInTheDocument()
	})

	it('runs the manual update check on the shared updater instance', async () => {
		// The update dialog lives on App's updater; if the button checked on a private
		// instance, a dismissed update could never be reopened from Settings.
		const checkNow = vi.fn().mockResolvedValue(undefined)
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={systemClient()}
				updater={updaterState({ checkNow })}
			/>,
		)
		await screen.findByText('Version 0.1.0')

		await userEvent.click(
			screen.getByRole('button', { name: /Check updates/ }),
		)

		expect(checkNow).toHaveBeenCalledOnce()
	})

	it('keeps infrequent settings in a collapsed Advanced section', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')

		const advanced = screen.getByRole('button', { name: /Advanced/ })
		expect(advanced).toHaveAttribute('aria-expanded', 'false')
		expect(
			screen.queryByText('Application discovery'),
		).not.toBeInTheDocument()

		await userEvent.click(advanced)
		expect(advanced).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByText('Application discovery')).toBeInTheDocument()
	})

	it('does not render catalog visibility counts outside scan diagnostics', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		expect(
			screen.queryByText('Primary applications'),
		).not.toBeInTheDocument()
		expect(screen.queryByText('Auxiliary tools')).not.toBeInTheDocument()
	})

	it('keeps scan diagnostics collapsed until toggled', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				catalogDiagnostics={{
					completedAt: 1,
					durationMs: 1936,
					mode: 'startup',
					totalApps: 269,
					sourceCounts: { registry: 9 },
					added: 0,
					removed: 0,
					updated: 77,
				}}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		const toggle = screen.getByRole('button', {
			name: 'Last scan diagnostics',
		})
		expect(toggle).toHaveAttribute('aria-expanded', 'false')
		expect(screen.queryByText('Duration')).not.toBeInTheDocument()

		await userEvent.click(toggle)
		expect(toggle).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByText('Duration')).toBeInTheDocument()

		await userEvent.click(toggle)
		fireEvent.transitionEnd(
			screen.getByText('Duration').closest('#catalog-diagnostics')!,
			{ propertyName: 'grid-template-rows' },
		)
		expect(screen.queryByText('Duration')).not.toBeInTheDocument()
	})

	// A source that keeps failing serves months-old records and used to say nothing at all. The
	// row has to name the state, the count it is still serving, and the failure streak.
	it('reports a source that is serving older data', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				catalogDiagnostics={{
					completedAt: 1,
					durationMs: 10,
					mode: 'refresh',
					totalApps: 12,
					sourceCounts: { registry: 9 },
					added: 0,
					removed: 0,
					updated: 0,
					sources: [
						{
							key: 'start-apps',
							state: 'stale',
							lastAttemptAt: 1_700_000_000,
							lastSuccessAt: 1_699_000_000,
							consecutiveFailures: 8,
							lastDurationMs: 25,
							lastError: 'provider_failed',
							recordCount: 41,
						},
					],
				}}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()
		await userEvent.click(
			screen.getByRole('button', { name: 'Last scan diagnostics' }),
		)

		const row = screen.getByRole('row', { name: /start-apps/ })
		expect(row).toHaveTextContent('Serving older data')
		expect(row).toHaveTextContent('Did not answer')
		expect(row).toHaveTextContent('41')
		expect(row).toHaveTextContent('8')
	})

	it('shows no source table when the cache predates source health', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				catalogDiagnostics={{
					completedAt: 1,
					durationMs: 10,
					mode: 'startup',
					totalApps: 12,
					sourceCounts: { registry: 9 },
					added: 0,
					removed: 0,
					updated: 0,
				}}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()
		await userEvent.click(
			screen.getByRole('button', { name: 'Last scan diagnostics' }),
		)

		expect(screen.queryByRole('table')).not.toBeInTheDocument()
	})

	// The number that would expose a wrong availability verdict on a machine no fixture models:
	// applications this rule kept that the rule it replaced would have deleted.
	it('reports how far the launch-target rule diverged from the one it replaced', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				catalogDiagnostics={{
					completedAt: 1,
					durationMs: 10,
					mode: 'startup',
					totalApps: 12,
					sourceCounts: { registry: 9 },
					added: 0,
					removed: 0,
					updated: 0,
					targetAvailability: {
						byReason: {
							'target.present': 10,
							'target.unverifiable.access_denied': 2,
						},
						keptByNewRule: 2,
					},
				}}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()
		await userEvent.click(
			screen.getByRole('button', { name: 'Last scan diagnostics' }),
		)

		expect(screen.getByText('Verified on disk')).toBeInTheDocument()
		expect(
			screen.getByText('Not checked — access denied'),
		).toBeInTheDocument()
		expect(
			screen.getByText(/Kept by the current rule: 2/),
		).toBeInTheDocument()
	})

	it('shows no launch-target panel when the cache predates the diff', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				catalogDiagnostics={{
					completedAt: 1,
					durationMs: 10,
					mode: 'startup',
					totalApps: 12,
					sourceCounts: { registry: 9 },
					added: 0,
					removed: 0,
					updated: 0,
				}}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()
		await userEvent.click(
			screen.getByRole('button', { name: 'Last scan diagnostics' }),
		)

		expect(
			screen.queryByText('Launch target check'),
		).not.toBeInTheDocument()
	})

	it('does not render manual icon-maintenance controls', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')

		expect(
			screen.queryByRole('button', { name: 'Repair missing icons' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Clear icon cache' }),
		).not.toBeInTheDocument()
	})

	it('confirms and starts a forced full scan', async () => {
		const onForceFullScan = vi.fn().mockResolvedValue(undefined)
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={onForceFullScan}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		await userEvent.click(
			screen.getByRole('button', { name: 'Force full scan' }),
		)
		expect(onForceFullScan).not.toHaveBeenCalled()
		await userEvent.click(
			screen.getByRole('button', { name: 'Confirm full scan' }),
		)

		expect(onForceFullScan).toHaveBeenCalledOnce()
	})

	it('returns focus to the full scan trigger when confirmation closes', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()
		const trigger = screen.getByRole('button', { name: 'Force full scan' })
		await userEvent.click(trigger)
		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(trigger).toHaveFocus()
	})

	it('uses readable dark text in the catalog maintenance confirmation', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		await userEvent.click(
			screen.getByRole('button', { name: 'Force full scan' }),
		)
		expect(screen.getByText(/The next scan will take longer/)).toHaveClass(
			'text-slate-700',
		)
		expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass(
			'text-slate-700',
		)
	})

	it('confirms and resets the catalog cache', async () => {
		const onResetCatalogCache = vi.fn().mockResolvedValue(undefined)
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				onResetCatalogCache={onResetCatalogCache}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		await userEvent.click(
			screen.getByRole('button', { name: 'Reset catalog cache' }),
		)
		expect(onResetCatalogCache).not.toHaveBeenCalled()
		await userEvent.click(
			screen.getByRole('button', { name: 'Confirm reset' }),
		)

		expect(onResetCatalogCache).toHaveBeenCalledOnce()
	})

	// Both confirmations used to stack, asking two questions about the same catalog at once.
	it('replaces the open confirmation instead of stacking a second one', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				onResetCatalogCache={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		await userEvent.click(
			screen.getByRole('button', { name: 'Force full scan' }),
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Reset catalog cache' }),
		)

		expect(
			screen.getByRole('dialog', { name: 'Confirm catalog cache reset' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('dialog', { name: 'Confirm full scan' }),
		).not.toBeInTheDocument()

		await userEvent.click(
			screen.getByRole('button', { name: 'Force full scan' }),
		)

		expect(
			screen.getByRole('dialog', { name: 'Confirm full scan' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('dialog', {
				name: 'Confirm catalog cache reset',
			}),
		).not.toBeInTheDocument()
		// One question, one answer: never two Cancel buttons on screen.
		expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(
			1,
		)
	})

	// Swapping confirmations is not a dismissal — pulling focus back to the other trigger would
	// move the keyboard away from the panel the user just opened.
	it('keeps focus on the trigger that opened the confirmation when swapping', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				onResetCatalogCache={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		await userEvent.click(
			screen.getByRole('button', { name: 'Force full scan' }),
		)
		const reset = screen.getByRole('button', {
			name: 'Reset catalog cache',
		})
		await userEvent.click(reset)

		expect(reset).toHaveFocus()
	})

	it('uses dark-theme-safe settings surfaces and danger controls', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				updater={updaterState()}
				client={systemClient()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				onResetCatalogCache={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()

		expect(
			screen.getByText('Application discovery').closest('div'),
		).toBeTruthy()
		expect(
			screen.getByRole('button', { name: 'Reset catalog cache' }),
		).toHaveClass('danger-button')
		expect(
			screen
				.getByText('Catalog maintenance')
				.closest('.settings-surface'),
		).toBeInTheDocument()
	})

	it('loads system settings and opens the external links', async () => {
		const client: SystemClient = {
			getSettings: vi.fn().mockResolvedValue({
				version: '0.1.0',
				shortcut: {
					available: true,
					label: 'Win+Shift+Q',
					error: null,
				},
				scanSettings: {
					autoScanFixedDrives: true,
					includedPaths: [String.raw`D:\Games`],
					excludedPaths: [],
				},
				fixedDrives: ['C:\\', 'D:\\', 'E:\\'],
				hideToTrayOnClose: true,
			}),
			setScanSettings: vi
				.fn()
				.mockImplementation(async settings => settings),
			setCloseBehavior: vi.fn().mockImplementation(async value => value),
			savePreferencesBackup: vi.fn().mockResolvedValue(true),
			exportDiagnosticsLog: vi.fn().mockResolvedValue(true),
			pickFolder: vi.fn().mockResolvedValue(String.raw`F:\Stick\Tools`),
			openTelegram: vi.fn().mockResolvedValue(undefined),
			openGithub: vi.fn().mockResolvedValue(undefined),
			openAppsSettings: vi.fn().mockResolvedValue(undefined),
			openStartupSettings: vi.fn().mockResolvedValue(undefined),
		}
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)
		expect(await screen.findByText('Version 0.1.0')).toBeInTheDocument()
		expect(screen.getByText('Win+Shift+Q')).toBeInTheDocument()
		await userEvent.click(
			screen.getByRole('button', { name: 'Open @keskiyo on Telegram' }),
		)
		expect(client.openTelegram).toHaveBeenCalledOnce()
		await userEvent.click(
			screen.getByRole('button', {
				name: 'Open AppNook on GitHub',
			}),
		)
		expect(client.openGithub).toHaveBeenCalledOnce()
		await openAdvancedSettings()
		expect(screen.getByText('Fixed local drives')).toBeInTheDocument()
		expect(screen.getByText('E:\\')).toBeInTheDocument()
		await userEvent.click(
			screen.getByRole('button', { name: 'Browse for scan folder' }),
		)
		expect(client.setScanSettings).toHaveBeenCalledWith({
			autoScanFixedDrives: true,
			includedPaths: [String.raw`D:\Games`, String.raw`F:\Stick\Tools`],
			excludedPaths: [],
		})
	})

	it('adds a removable-drive folder picked from the native dialog', async () => {
		const client: SystemClient = {
			getSettings: vi.fn().mockResolvedValue({
				version: '0.1.0',
				shortcut: {
					available: true,
					label: 'Win+Shift+Q',
					error: null,
				},
				scanSettings: {
					autoScanFixedDrives: true,
					includedPaths: [],
					excludedPaths: [],
				},
				fixedDrives: ['C:\\'],
				hideToTrayOnClose: true,
			}),
			setScanSettings: vi
				.fn()
				.mockImplementation(async settings => settings),
			setCloseBehavior: vi.fn().mockImplementation(async value => value),
			savePreferencesBackup: vi.fn().mockResolvedValue(true),
			exportDiagnosticsLog: vi.fn().mockResolvedValue(true),
			pickFolder: vi.fn().mockResolvedValue(String.raw`F:\Stick\Tools`),
			openTelegram: vi.fn().mockResolvedValue(undefined),
			openGithub: vi.fn().mockResolvedValue(undefined),
			openAppsSettings: vi.fn().mockResolvedValue(undefined),
			openStartupSettings: vi.fn().mockResolvedValue(undefined),
		}
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)
		await screen.findByText('Version 0.1.0')
		await openAdvancedSettings()
		await userEvent.click(
			screen.getByRole('button', { name: 'Browse for scan folder' }),
		)
		expect(client.pickFolder).toHaveBeenCalledOnce()
		expect(client.setScanSettings).toHaveBeenCalledWith({
			autoScanFixedDrives: true,
			includedPaths: [String.raw`F:\Stick\Tools`],
			excludedPaths: [],
		})
	})
})
