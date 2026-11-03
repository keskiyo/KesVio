import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDiscoveryControls } from '../../../../src/pages/settings/ui/sections/SettingsDiscoveryControls'
import type { SystemSettings } from '../../../../src/entities/system'

const settings: SystemSettings = {
	version: '0.2.8',
	shortcut: {
		available: true,
		pending: false,
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
	startupEntry: 'disabled',
}

describe('SettingsDiscoveryControls', () => {
	it('lets a long saved path shrink within the discovery grid', () => {
		const path = `C:\\${'long-folder-name\\'.repeat(25)}`
		render(
			<SettingsDiscoveryControls
				settings={{
					...settings,
					scanSettings: {
						...settings.scanSettings,
						includedPaths: [path],
					},
				}}
				saving={false}
				onSaveScanSettings={vi.fn()}
				onAddPath={vi.fn()}
				onRemovePath={vi.fn()}
				onPickFolder={vi.fn()}
			/>,
		)
		const input = screen.getByRole('textbox', {
			name: 'Additional scan folder',
		})
		expect(input.parentElement?.parentElement?.parentElement).toHaveClass(
			'min-w-0',
		)
		expect(screen.getByText(path)).toHaveAttribute('title', path)
	})
	it.each([
		['Additional scan folder', 'Add scan folder', 'includedPaths'],
		['Excluded folder', 'Exclude folder', 'excludedPaths'],
	])(
		'submits a manually entered %s by button and Enter',
		async (label, button, kind) => {
			const onAddPath = vi.fn()
			render(
				<SettingsDiscoveryControls
					settings={settings}
					saving={false}
					onSaveScanSettings={vi.fn()}
					onAddPath={onAddPath}
					onRemovePath={vi.fn()}
					onPickFolder={vi.fn()}
				/>,
			)
			const input = screen.getByRole('textbox', { name: label })
			const add = screen.getByRole('button', { name: button })
			expect(add).toBeDisabled()
			await userEvent.type(input, '   ')
			expect(add).toBeDisabled()
			await userEvent.keyboard('{Enter}')
			expect(onAddPath).not.toHaveBeenCalled()
			await userEvent.clear(input)
			await userEvent.type(input, ' D:\\Apps ')
			await userEvent.click(add)
			expect(onAddPath).toHaveBeenLastCalledWith(kind, 'D:\\Apps')
			expect(input).toHaveValue('')
			await userEvent.type(input, 'E:\\Tools{Enter}')
			expect(onAddPath).toHaveBeenLastCalledWith(kind, 'E:\\Tools')
			expect(onAddPath).toHaveBeenCalledTimes(2)
		},
	)

	it('blocks manual submit while settings are saving', async () => {
		const onAddPath = vi.fn()
		const props = {
			settings,
			saving: false,
			onSaveScanSettings: vi.fn(),
			onAddPath,
			onRemovePath: vi.fn(),
			onPickFolder: vi.fn(),
		}
		const { rerender } = render(<SettingsDiscoveryControls {...props} />)
		const input = screen.getByRole('textbox', {
			name: 'Additional scan folder',
		})
		await userEvent.type(input, 'D:\\Apps')
		rerender(<SettingsDiscoveryControls {...props} saving />)
		expect(input).toBeDisabled()
		expect(
			screen.getByRole('button', { name: 'Add scan folder' }),
		).toBeDisabled()
		await userEvent.keyboard('{Enter}')
		expect(onAddPath).not.toHaveBeenCalled()
	})
	it('explains that fixed drives are scanned on a forced scan by default', () => {
		render(
			<SettingsDiscoveryControls
				settings={settings}
				saving={false}
				onSaveScanSettings={vi.fn()}
				onAddPath={vi.fn()}
				onRemovePath={vi.fn()}
				onPickFolder={vi.fn()}
			/>,
		)

		expect(screen.getByText('Choose where KesVio scans.')).toBeVisible()
		expect(
			screen.getByRole('switch', {
				name: 'Include fixed drives in Force full scan',
			}),
		).toBeVisible()
		expect(
			screen.getByText(
				'Fixed drives are walked only during Force full scan. An ordinary refresh reads Windows sources and the folders added below.',
			),
		).toBeVisible()
	})

	it('saves a selected scan folder through the provided settings actions', async () => {
		const onAddPath = vi.fn()
		const onPickFolder = vi.fn().mockResolvedValue(String.raw`F:\Tools`)
		render(
			<SettingsDiscoveryControls
				settings={settings}
				saving={false}
				onSaveScanSettings={vi.fn()}
				onAddPath={onAddPath}
				onRemovePath={vi.fn()}
				onPickFolder={onPickFolder}
			/>,
		)

		await userEvent.click(
			screen.getByRole('button', { name: 'Browse for scan folder' }),
		)

		expect(onPickFolder).toHaveBeenCalledOnce()
		expect(onAddPath).toHaveBeenCalledWith(
			'includedPaths',
			String.raw`F:\Tools`,
		)
	})

	it('requires confirmation before removing a scan folder', async () => {
		const onRemovePath = vi.fn()
		const settingsWithPath: SystemSettings = {
			...settings,
			scanSettings: {
				...settings.scanSettings,
				includedPaths: [String.raw`D:\Apps`],
			},
		}
		render(
			<SettingsDiscoveryControls
				settings={settingsWithPath}
				saving={false}
				onSaveScanSettings={vi.fn()}
				onAddPath={vi.fn()}
				onRemovePath={onRemovePath}
				onPickFolder={vi.fn()}
			/>,
		)

		await userEvent.click(
			screen.getByRole('button', { name: String.raw`Remove D:\Apps` }),
		)

		expect(onRemovePath).not.toHaveBeenCalled()
		const dialog = screen.getByRole('alertdialog', {
			name: 'Remove scan folder',
		})
		expect(dialog).toBeVisible()
		expect(within(dialog).getByText(String.raw`D:\Apps`)).toBeVisible()

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(onRemovePath).not.toHaveBeenCalled()

		await userEvent.click(
			screen.getByRole('button', { name: String.raw`Remove D:\Apps` }),
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Remove folder' }),
		)

		expect(onRemovePath).toHaveBeenCalledOnce()
		expect(onRemovePath).toHaveBeenCalledWith(
			'includedPaths',
			String.raw`D:\Apps`,
		)
	})

	it('identifies an excluded folder and keeps a long path readable', async () => {
		const longPath = String.raw`E:\Development\Very long workspace directory\Applications\Utilities`
		const onRemovePath = vi.fn()
		const settingsWithPath: SystemSettings = {
			...settings,
			scanSettings: {
				...settings.scanSettings,
				excludedPaths: [longPath],
			},
		}
		render(
			<SettingsDiscoveryControls
				settings={settingsWithPath}
				saving={false}
				onSaveScanSettings={vi.fn()}
				onAddPath={vi.fn()}
				onRemovePath={onRemovePath}
				onPickFolder={vi.fn()}
			/>,
		)

		await userEvent.click(
			screen.getByRole('button', { name: `Remove ${longPath}` }),
		)

		const dialog = screen.getByRole('alertdialog', {
			name: 'Remove excluded folder',
		})
		expect(dialog).toBeVisible()
		expect(within(dialog).getByText(longPath)).toHaveClass('break-all')
		expect(onRemovePath).not.toHaveBeenCalled()

		await userEvent.click(
			within(dialog).getByRole('button', { name: 'Remove folder' }),
		)

		expect(onRemovePath).toHaveBeenCalledWith('excludedPaths', longPath)
	})
})
