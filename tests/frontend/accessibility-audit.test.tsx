import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { createAppStore } from '../../src/app/store/appStore'
import type { AppInfo, AppsClient } from '../../src/entities/app'
import type { SystemClient } from '../../src/entities/system'

function app(
	value: Partial<AppInfo> &
		Pick<AppInfo, 'id' | 'name' | 'path' | 'category'>,
): AppInfo {
	return {
		iconBase64: null,
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		...value,
	}
}

const apps: AppInfo[] = [
	app({
		id: 'steam',
		name: 'Steam',
		path: 'C:\\Steam.exe',
		category: 'games',
		preferenceIdentity: 'identity:steam',
	}),
	app({
		id: 'code',
		name: 'Visual Studio Code',
		path: 'C:\\Code.exe',
		category: 'development',
		preferenceIdentity: 'identity:code',
	}),
]

function renderApp() {
	const client: AppsClient = {
		getApps: vi.fn().mockResolvedValue({ apps, hasCache: true }),
		refreshApps: vi.fn().mockResolvedValue({ apps, generation: 1 }),
		cancelScan: vi.fn().mockResolvedValue(undefined),
		launchApp: vi.fn().mockResolvedValue(undefined),
		closeApps: vi.fn().mockResolvedValue({
			closed: 0,
			notRunning: 0,
			unavailable: 0,
			failed: 0,
		}),
		onScanProgress: vi.fn().mockResolvedValue(() => undefined),
		getAppDetails: vi.fn().mockResolvedValue({
			fileSizeBytes: null,
			fileCreatedAt: null,
			fileModifiedAt: null,
			architecture: 'unknown',
			signature: 'unavailable',
			executableExists: null,
			installLocationExists: null,
		}),
		openAppFolder: vi.fn().mockResolvedValue(undefined),
	}
	const systemClient: SystemClient = {
		getSettings: vi.fn().mockResolvedValue({
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
		}),
		setScanSettings: vi.fn().mockImplementation(async s => s),
		setCloseBehavior: vi.fn().mockImplementation(async value => value),
		setStartupEnabled: vi.fn().mockResolvedValue('disabled'),
		savePreferencesBackup: vi.fn().mockResolvedValue(true),
		exportDiagnosticsLog: vi.fn().mockResolvedValue(true),
		previewDiagnosticsLog: vi
			.fn()
			.mockResolvedValue('<diagnostics redacted="true" />'),
		pickFolder: vi.fn().mockResolvedValue(null),
		openTelegram: vi.fn().mockResolvedValue(undefined),
		openGithub: vi.fn().mockResolvedValue(undefined),
		openAppsSettings: vi.fn().mockResolvedValue(undefined),
	}
	const store = createAppStore(client, localStorage)
	render(
		<App store={store} systemClient={systemClient} appsClient={client} />,
	)
	return { client, store }
}

// The flows this audit cycle added each open a modal from a control that may itself go away
// (a menu item, a drawer button). A keyboard user must land inside the dialog and come back to
// where they were; a screen-reader user must hear the dialog's name and its fields.
describe('accessibility audit — audit-cycle flows', () => {
	beforeEach(() => {
		localStorage.clear()
		document.body.style.overflow = ''
		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			value: vi.fn(() => ({
				matches: false,
				media: '',
				onchange: null,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				addListener: vi.fn(),
				removeListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		})
		Object.defineProperty(Element.prototype, 'scrollIntoView', {
			configurable: true,
			value: vi.fn(),
		})
		Object.defineProperty(Element.prototype, 'scrollTo', {
			configurable: true,
			value: vi.fn(),
		})
		Object.defineProperty(window, 'scrollTo', {
			configurable: true,
			value: vi.fn(),
		})
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			cb(0)
			return 1
		})
	})

	it('opens the filter editor from the drawer with focus on the name and returns focus to the New filter button', async () => {
		renderApp()
		await screen.findByText('Steam')
		await userEvent.click(
			screen.getByRole('button', { name: 'Open navigation' }),
		)
		const navigation = screen.getByRole('dialog', {
			name: 'App navigation',
		})
		const create = within(navigation).getByRole('button', {
			name: 'New filter',
		})
		await userEvent.click(create)

		// The editor opens over the drawer, which is a modal of its own. Only the topmost modal
		// may trap Tab or answer Escape: before, Shift+Tab pulled focus into the drawer behind
		// the editor and one Escape closed both, leaving focus on the body.
		const dialog = await screen.findByRole('dialog', { name: 'New filter' })
		expect(dialog).toHaveAttribute('aria-modal', 'true')
		expect(
			within(dialog).getByRole('textbox', { name: 'Name' }),
		).toHaveFocus()
		await userEvent.tab()
		expect(dialog.contains(document.activeElement)).toBe(true)
		await userEvent.tab({ shift: true })
		await userEvent.tab({ shift: true })
		expect(dialog.contains(document.activeElement)).toBe(true)

		await userEvent.keyboard('{Escape}')

		expect(
			screen.queryByRole('dialog', { name: 'New filter' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('dialog', { name: 'App navigation' }),
		).toBeInTheDocument()
		expect(create).toHaveFocus()

		await userEvent.keyboard('{Escape}')
		expect(
			screen.queryByRole('dialog', { name: 'App navigation' }),
		).not.toBeInTheDocument()
	})

	it('names the undo control in the More page card and on the toast', async () => {
		renderApp()
		await userEvent.click(
			await screen.findByRole('button', { name: 'Manage Steam' }),
		)
		await userEvent.click(
			await screen.findByRole('menuitem', { name: 'Hide from catalog' }),
		)

		const toastUndo = await screen.findByRole('button', { name: 'Undo' })
		expect(toastUndo.closest('[role="status"], [aria-live]')).not.toBeNull()

		await userEvent.click(
			screen.getByRole('button', { name: 'Open navigation' }),
		)
		await userEvent.click(
			within(
				screen.getByRole('dialog', { name: 'App navigation' }),
			).getByRole('button', { name: 'More' }),
		)
		const card = await screen.findByRole('region', { name: 'Last change' })
		expect(card).toHaveTextContent('Hid Steam')
		await userEvent.click(
			within(card).getByRole('button', { name: 'Undo' }),
		)

		expect(
			screen.queryByRole('region', { name: 'Last change' }),
		).not.toBeInTheDocument()
	})
})
