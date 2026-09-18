import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '../../../../src/pages/settings/ui/SettingsPage'
import type { UpdaterState } from '../../../../src/features/update-app'
import type { SystemClient } from '../../../../src/entities/system'

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
		startupEntry: 'disabled',
	}

	const systemClient = (): SystemClient => ({
		getSettings: vi.fn().mockResolvedValue(settings),
		setScanSettings: vi.fn().mockImplementation(async value => value),
		setCloseBehavior: vi.fn().mockImplementation(async value => value),
		setStartupEnabled: vi
			.fn()
			.mockImplementation(async enabled =>
				enabled ? 'enabled' : 'disabled',
			),
		savePreferencesBackup: vi.fn().mockResolvedValue(true),
		exportDiagnosticsLog: vi.fn().mockResolvedValue(true),
		previewDiagnosticsLog: vi
			.fn()
			.mockResolvedValue('<diagnostics redacted="true" />'),
		pickFolder: vi.fn().mockResolvedValue(null),
		openTelegram: vi.fn().mockResolvedValue(undefined),
		openGithub: vi.fn().mockResolvedValue(undefined),
		openAppsSettings: vi.fn().mockResolvedValue(undefined),
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
		automaticChecks: true,
		checkNow: vi.fn().mockResolvedValue(undefined),
		install: vi.fn().mockResolvedValue(undefined),
		dismiss: vi.fn(),
		setAutomaticChecks: vi.fn(),
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

	it('switches startup on through the backend and shows what Windows answered', async () => {
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
			screen.queryByRole('button', { name: 'Manage startup in Windows' }),
		).not.toBeInTheDocument()
		const toggle = screen.getByRole('switch', {
			name: 'Launch KesVio when Windows starts',
		})
		expect(toggle).not.toBeChecked()

		await userEvent.click(toggle)

		expect(client.setStartupEnabled).toHaveBeenCalledWith(true)
		expect(
			await screen.findByRole('switch', {
				name: 'Launch KesVio when Windows starts',
			}),
		).toBeChecked()
		expect(
			screen.getByText(
				'KesVio starts hidden in the tray when you sign in.',
			),
		).toBeInTheDocument()
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

		for (const description of [
			'Choose where KesVio scans.',
			'Rebuild the application catalog.',
		]) {
			expect(screen.getByText(description)).toBeInTheDocument()
		}
	})

	// Source health, scan diagnostics, the diagnostics log and the preferences backup moved to
	// the Catalog Health and Backup & Restore pages under More; Settings keeps only the
	// controls that change how the catalog is built.
	it('no longer hosts the diagnostics and backup sections', async () => {
		const client = systemClient()
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
				onForceFullScan={vi.fn().mockResolvedValue(undefined)}
				onResetCatalogCache={vi.fn().mockResolvedValue(undefined)}
			/>,
		)
		await screen.findByText('Version 0.1.0')

		for (const gone of [
			'Catalog sources',
			'Last scan diagnostics',
			'Diagnostics log',
			'Backup & restore',
		])
			expect(screen.queryByText(gone)).not.toBeInTheDocument()
		for (const name of [
			'Refresh catalog',
			'Export settings',
			'Import settings',
			'Restore local backup',
			'Preview redacted log',
			'Export log as XML',
		])
			expect(
				screen.queryByRole('button', { name }),
			).not.toBeInTheDocument()
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByText('Application discovery')).toBeInTheDocument()
		expect(screen.getByText('Catalog maintenance')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Force full scan' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Reset catalog cache' }),
		).toBeInTheDocument()
		expect(client.previewDiagnosticsLog).not.toHaveBeenCalled()
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

		for (const guarantee of [
			'Fixed drives are walked only during Force full scan. An ordinary refresh reads Windows sources and the folders added below.',
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
			screen.getByText('Closing the window quits KesVio.'),
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

	// The collapsed Advanced disclosure went with the sections it used to hide; what is left
	// is one open block below General, laid out the same way.
	it('shows the catalog settings as an open block below the general ones', async () => {
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
			screen.queryByRole('button', { name: /Advanced/ }),
		).not.toBeInTheDocument()
		const block = screen.getByRole('region', { name: 'Catalog' })
		expect(block).toHaveClass('settings-surface')
		expect(within(block).getByText('Catalog').className).toBe(
			screen.getByText('Appearance').className,
		)
		const rows = ['Application discovery', 'Catalog maintenance'].map(
			title => within(block).getByText(title),
		)
		expect(rows[0]!.compareDocumentPosition(rows[1]!)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		)
		expect(
			screen.getByText('Updates & links').compareDocumentPosition(block),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
		expect(
			within(block).getByRole('button', { name: 'Force full scan' }),
		).toBeInTheDocument()
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

		expect(
			screen.queryByText('Primary applications'),
		).not.toBeInTheDocument()
		expect(screen.queryByText('Auxiliary tools')).not.toBeInTheDocument()
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
				startupEntry: 'disabled',
			}),
			setScanSettings: vi
				.fn()
				.mockImplementation(async settings => settings),
			setCloseBehavior: vi.fn().mockImplementation(async value => value),
			savePreferencesBackup: vi.fn().mockResolvedValue(true),
			exportDiagnosticsLog: vi.fn().mockResolvedValue(true),
			previewDiagnosticsLog: vi
				.fn()
				.mockResolvedValue('<diagnostics redacted="true" />'),
			pickFolder: vi.fn().mockResolvedValue(String.raw`F:\Stick\Tools`),
			openTelegram: vi.fn().mockResolvedValue(undefined),
			openGithub: vi.fn().mockResolvedValue(undefined),
			openAppsSettings: vi.fn().mockResolvedValue(undefined),
			setStartupEnabled: vi.fn().mockResolvedValue('disabled'),
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
				name: 'Open KesVio on GitHub',
			}),
		)
		expect(client.openGithub).toHaveBeenCalledOnce()
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
			previewDiagnosticsLog: vi
				.fn()
				.mockResolvedValue('<diagnostics redacted="true" />'),
			pickFolder: vi.fn().mockResolvedValue(String.raw`F:\Stick\Tools`),
			openTelegram: vi.fn().mockResolvedValue(undefined),
			openGithub: vi.fn().mockResolvedValue(undefined),
			openAppsSettings: vi.fn().mockResolvedValue(undefined),
			setStartupEnabled: vi.fn().mockResolvedValue('disabled'),
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
