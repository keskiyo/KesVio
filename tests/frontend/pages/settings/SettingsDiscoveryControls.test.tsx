import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDiscoveryControls } from '../../../../src/pages/settings/ui/sections/SettingsDiscoveryControls'
import type { SystemSettings } from '../../../../src/entities/system'

const settings: SystemSettings = {
	version: '0.2.8',
	shortcut: { available: true, label: 'Win+Shift+Q', error: null },
	scanSettings: {
		autoScanFixedDrives: true,
		includedPaths: [],
		excludedPaths: [],
	},
	fixedDrives: ['C:\\'],
	hideToTrayOnClose: true,
}

describe('SettingsDiscoveryControls', () => {
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

		expect(
			screen.getByText(
				'Ordinary refresh scans Windows sources and added folders. Fixed drives are walked during Force full scan, which is on by default.',
			),
		).toBeVisible()
		expect(
			screen.getByRole('switch', {
				name: 'Include fixed drives in Force full scan',
			}),
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
})
