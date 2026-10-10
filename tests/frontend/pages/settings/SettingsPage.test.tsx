import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '../../../../src/pages/settings/ui/SettingsPage'
import type { UpdaterState } from '../../../../src/features/update-app'
import type { SystemClient } from '../../../../src/entities/system'

const changes = (dialog: HTMLElement) =>
	within(dialog)
		.getAllByRole('listitem')
		.map(item => item.textContent)

const recording = () =>
	screen.queryByRole('button', { name: 'Cancel shortcut change' })

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
		phase: 'idle',
		error: null,
		status: 'idle',
		automaticChecks: true,
		checkNow: vi.fn().mockResolvedValue(undefined),
		install: vi.fn().mockResolvedValue(undefined),
		setAutomaticChecks: vi.fn(),
		...overrides,
	})

	it('lists the editable global shortcut and the three fixed shortcuts', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={systemClient()}
				updater={updaterState()}
			/>,
		)

		const shortcuts = await screen.findByRole('region', {
			name: 'Keyboard shortcuts',
		})
		const catalog = screen.getByRole('region', { name: 'Catalog' })
		expect(within(shortcuts).getByText('Win+Shift+Q')).toBeVisible()
		expect(within(shortcuts).getByText('Show KesVio')).toBeVisible()
		expect(within(shortcuts).getByText('Search')).toBeVisible()
		expect(within(shortcuts).getByText('Ctrl+F')).toBeVisible()
		expect(within(shortcuts).getByText('Quick launcher')).toBeVisible()
		expect(within(shortcuts).getByText('Ctrl+K')).toBeVisible()
		expect(within(shortcuts).getByText('Scenario launcher')).toBeVisible()
		expect(within(shortcuts).getByText('Ctrl+Shift+K')).toBeVisible()
		expect(
			within(shortcuts).getByRole('button', {
				name: 'Change global shortcut, currently Win+Shift+Q',
			}),
		).toHaveTextContent('Change')
		const globalShortcut = within(shortcuts).getByRole('group', {
			name: 'Global shortcut',
		})
		expect(within(globalShortcut).getByText('Win+Shift+Q')).toBeVisible()
		expect(
			within(globalShortcut).getByRole('button', {
				name: 'Change global shortcut, currently Win+Shift+Q',
			}),
		).toBeVisible()
		expect(shortcuts.compareDocumentPosition(catalog)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		)
	})

	it('captures and saves a valid global shortcut', async () => {
		const setGlobalShortcut = vi.fn().mockResolvedValue({
			available: true,
			label: 'Ctrl+Alt+P',
			error: null,
		})
		const client = { ...systemClient(), setGlobalShortcut }
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, {
			key: 'p',
			code: 'KeyP',
			ctrlKey: true,
			altKey: true,
		})

		expect(setGlobalShortcut).not.toHaveBeenCalled()
		const dialog = screen.getByRole('alertdialog', {
			name: 'Confirm shortcut',
		})
		expect(dialog).toHaveTextContent('Use Ctrl+Alt+P to open KesVio?')
		expect(changes(dialog)).toEqual([
			'Ctrl+Alt+P will stop typing its AltGr character',
			'Ctrl+Alt+P will open KesVio from anywhere',
			'Win+Shift+Q will stop opening KesVio',
		])
		const confirm = within(dialog).getByRole('button', {
			name: 'Use Ctrl+Alt+P',
		})
		expect(confirm).toHaveClass('danger-button')
		await userEvent.click(confirm)

		expect(setGlobalShortcut).toHaveBeenCalledWith({
			win: false,
			ctrl: true,
			alt: true,
			shift: false,
			key: 'KeyP',
		})
		expect(await screen.findByText('Ctrl+Alt+P')).toBeVisible()
	})

	it('refuses a Windows shortcut in the row and suggests a free one', async () => {
		const setGlobalShortcut = vi.fn()
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={{ ...systemClient(), setGlobalShortcut }}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, { key: 'e', code: 'KeyE', metaKey: true })

		expect(
			screen.getByText(
				'Windows keeps Win+E for opening File Explorer. Try Win+Shift+E.',
			),
		).toBeVisible()
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

		fireEvent.keyDown(shortcut, { key: '3', code: 'Digit3', metaKey: true })

		expect(
			screen.getByText(
				'Windows keeps Win+3 for opening the taskbar app pinned in position 3. Choose another shortcut.',
			),
		).toBeVisible()
		expect(recording()).toBeVisible()
		expect(setGlobalShortcut).not.toHaveBeenCalled()
	})

	it('refuses a standard app shortcut in the row', async () => {
		const setGlobalShortcut = vi.fn()
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={{ ...systemClient(), setGlobalShortcut }}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, { key: 'c', code: 'KeyC', ctrlKey: true })

		expect(
			screen.getByText(
				'Ctrl+C is used for copying in every app. Choose another shortcut.',
			),
		).toBeVisible()
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
		expect(setGlobalShortcut).not.toHaveBeenCalled()
	})

	it('cancels a risky shortcut from the confirmation without saving', async () => {
		const setGlobalShortcut = vi.fn()
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={{ ...systemClient(), setGlobalShortcut }}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, { key: '1', code: 'Digit1', ctrlKey: true })

		const dialog = screen.getByRole('alertdialog', {
			name: 'Confirm shortcut',
		})
		expect(changes(dialog)[0]).toBe(
			'Ctrl+1 will stop switching browser tabs in other apps',
		)
		await userEvent.click(
			within(dialog).getByRole('button', { name: 'Cancel' }),
		)

		expect(setGlobalShortcut).not.toHaveBeenCalled()
		expect(
			screen.queryByRole('alertdialog', { name: 'Confirm shortcut' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', {
				name: 'Change global shortcut, currently Win+Shift+Q',
			}),
		).toBeVisible()
	})

	it('keeps reserved in-app shortcuts out of the global binding', async () => {
		const setGlobalShortcut = vi.fn()
		const client = { ...systemClient(), setGlobalShortcut }
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		const appShortcuts = vi.fn()
		document.addEventListener('keydown', appShortcuts, { capture: true })
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, {
			key: 'k',
			code: 'KeyK',
			ctrlKey: true,
		})
		document.removeEventListener('keydown', appShortcuts, { capture: true })

		expect(setGlobalShortcut).not.toHaveBeenCalled()
		expect(appShortcuts).not.toHaveBeenCalled()
		expect(
			screen.getByText(
				'Ctrl+K already works inside KesVio. Choose another shortcut.',
			),
		).toBeVisible()
	})

	it('asks for a modifier when a bare key is pressed', async () => {
		const setGlobalShortcut = vi.fn()
		const client = { ...systemClient(), setGlobalShortcut }
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, { key: 'j', code: 'KeyJ' })

		expect(setGlobalShortcut).not.toHaveBeenCalled()
		expect(
			screen.getByText(
				'Add Win, Ctrl or Alt, then press a letter, digit or F1-F12.',
			),
		).toBeVisible()
	})

	it('explains how to record and why most Win+letter keys never arrive', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={systemClient()}
				updater={updaterState()}
			/>,
		)

		await userEvent.click(
			await screen.findByRole('button', {
				name: 'Change global shortcut, currently Win+Shift+Q',
			}),
		)

		expect(
			screen.getByText(
				'Hold the modifiers and press a key, e.g. Win+Shift+J. Most Win+letter shortcuts belong to Windows and never reach KesVio. Esc cancels.',
			),
		).toBeVisible()
		expect(
			screen.queryByRole('button', { name: 'Win' }),
		).not.toBeInTheDocument()
	})

	it('records a Win shortcut held on the keyboard', async () => {
		const setGlobalShortcut = vi.fn().mockResolvedValue({
			available: true,
			label: 'Win+Alt+J',
			error: null,
		})
		const client = { ...systemClient(), setGlobalShortcut }
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, {
			key: 'Meta',
			code: 'MetaLeft',
			metaKey: true,
		})
		fireEvent.keyDown(shortcut, {
			key: 'j',
			code: 'KeyJ',
			metaKey: true,
			altKey: true,
		})
		const dialog = screen.getByRole('alertdialog', {
			name: 'Confirm shortcut',
		})
		expect(changes(dialog)).toEqual([
			'Win+Alt+J will open KesVio from anywhere',
			'Win+Shift+Q will stop opening KesVio',
		])
		expect(dialog).toHaveTextContent(
			'If another app already uses Win+Alt+J, saving fails and Win+Shift+Q stays.',
		)
		const confirm = within(dialog).getByRole('button', {
			name: 'Use Win+Alt+J',
		})
		expect(confirm).not.toHaveClass('danger-button')
		await userEvent.click(confirm)

		expect(setGlobalShortcut).toHaveBeenCalledWith({
			win: true,
			ctrl: false,
			alt: true,
			shift: false,
			key: 'KeyJ',
		})
		expect(await screen.findByText('Win+Alt+J')).toBeVisible()
		expect(recording()).not.toBeInTheDocument()
	})

	it('lets Tab and Enter through while recording', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={systemClient()}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		await userEvent.click(shortcut)

		expect(fireEvent.keyDown(shortcut, { key: 'Tab', code: 'Tab' })).toBe(
			true,
		)
		expect(
			fireEvent.keyDown(shortcut, { key: 'Enter', code: 'Enter' }),
		).toBe(true)
		expect(recording()).toBeVisible()
	})

	it('shows a shortcut Windows refuses beside the shortcut row', async () => {
		const setGlobalShortcut = vi.fn().mockRejectedValue({
			code: 'GLOBAL_SHORTCUT_UNAVAILABLE',
			message: 'That shortcut is already in use. Choose another one.',
		})
		const client = { ...systemClient(), setGlobalShortcut }
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Win+Shift+Q',
		})
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, {
			key: 'J',
			code: 'KeyJ',
			metaKey: true,
			shiftKey: true,
		})
		await userEvent.click(
			within(
				screen.getByRole('alertdialog', { name: 'Confirm shortcut' }),
			).getByRole('button', { name: 'Use Win+Shift+J' }),
		)

		const shortcuts = screen.getByRole('region', {
			name: 'Keyboard shortcuts',
		})
		const alert = await within(shortcuts).findByRole('alert')
		expect(alert).toHaveTextContent(
			'Win+Shift+J: That shortcut is already in use. Choose another one.',
		)
		expect(within(shortcuts).getByText('Win+Shift+Q')).toBeVisible()
	})

	it('keeps recording when Windows takes focus and stops when the page does', async () => {
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={systemClient()}
				updater={updaterState()}
			/>,
		)

		await userEvent.click(
			await screen.findByRole('button', {
				name: 'Change global shortcut, currently Win+Shift+Q',
			}),
		)
		const cancel = screen.getByRole('button', {
			name: 'Cancel shortcut change',
		})
		const windowFocus = vi
			.spyOn(document, 'hasFocus')
			.mockReturnValue(false)
		fireEvent.blur(cancel, { relatedTarget: null })
		windowFocus.mockRestore()
		expect(recording()).toBeVisible()

		fireEvent.blur(cancel, {
			relatedTarget: screen.getByRole('switch', {
				name: 'Launch KesVio when Windows starts',
			}),
		})
		expect(recording()).not.toBeInTheDocument()
	})

	it('cancels recording from the same button', async () => {
		const setGlobalShortcut = vi.fn()
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={{ ...systemClient(), setGlobalShortcut }}
				updater={updaterState()}
			/>,
		)

		await userEvent.click(
			await screen.findByRole('button', {
				name: 'Change global shortcut, currently Win+Shift+Q',
			}),
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Cancel shortcut change' }),
		)

		expect(recording()).not.toBeInTheDocument()
		expect(setGlobalShortcut).not.toHaveBeenCalled()
	})

	it('cancels capture and restores the default shortcut', async () => {
		const setGlobalShortcut = vi.fn().mockResolvedValue({
			available: true,
			label: 'Win+Shift+Q',
			error: null,
		})
		const client = {
			...systemClient(),
			getSettings: vi.fn().mockResolvedValue({
				...settings,
				shortcut: {
					available: true,
					label: 'Ctrl+Alt+P',
					error: null,
				},
			}),
			setGlobalShortcut,
		}
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={client}
				updater={updaterState()}
			/>,
		)

		const shortcut = await screen.findByRole('button', {
			name: 'Change global shortcut, currently Ctrl+Alt+P',
		})
		await userEvent.click(shortcut)
		fireEvent.keyDown(shortcut, { key: 'Escape', code: 'Escape' })
		expect(setGlobalShortcut).not.toHaveBeenCalled()

		await userEvent.click(
			screen.getByRole('button', { name: 'Restore default shortcut' }),
		)

		expect(setGlobalShortcut).toHaveBeenCalledWith({
			win: true,
			ctrl: false,
			alt: false,
			shift: true,
			key: 'KeyQ',
		})
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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')
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
		await screen.findByText('Win+Shift+Q')
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
		await screen.findByText('Win+Shift+Q')

		for (const description of [
			'Works from anywhere in Windows.',
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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')
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
		await screen.findByText('Win+Shift+Q')

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
		// The sidebar update pill reads App's updater; if the button checked on a private
		// instance, a version found from Settings would never reach the pill.
		const checkNow = vi.fn().mockResolvedValue(undefined)
		render(
			<SettingsPage
				density="comfortable"
				onSetDensity={vi.fn()}
				client={systemClient()}
				updater={updaterState({ checkNow })}
			/>,
		)
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')
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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
		await screen.findByText('Win+Shift+Q')

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
			setGlobalShortcut: vi.fn().mockResolvedValue({
				available: true,
				label: 'Win+Shift+Q',
				error: null,
			}),
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
		expect(await screen.findByText('Win+Shift+Q')).toBeInTheDocument()
		expect(screen.queryByText(/Version 0\.1\.0/)).toBeNull()
		expect(screen.queryByRole('img', { name: 'KesVio logo' })).toBeNull()
		expect(
			screen.getByRole('heading', { level: 1, name: 'Settings' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('region', { name: 'Settings' }),
		).toBeInTheDocument()
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
			setGlobalShortcut: vi.fn().mockResolvedValue({
				available: true,
				label: 'Win+Shift+Q',
				error: null,
			}),
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
		await screen.findByText('Win+Shift+Q')
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
