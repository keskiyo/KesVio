import { beforeAll, describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { loadKnownPackageIndex } from '../../../../../src/entities/app/lib/search/knownPackageIndex'
import {
	matchedKnownEntries,
	resolveSearchAliases,
} from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import type { AppInfo } from '../../../../../src/entities/app'
import { app, msix, shortcut } from './fixtures/app'
import { EXTERNAL_ONLY } from './fixtures/catalogs/externalOnly'

interface NegativeRow {
	label: string
	record: AppInfo
	forbidden: string[]
	noExternalEntry?: true
}

// Hosted, helper, runtime and installer records built the way the scanner really sees them.
// None may borrow the identity of the package whose metadata it carries.
const ROWS: NegativeRow[] = [
	{
		label: 'Chrome-hosted PWA with Chrome Beta metadata',
		record: shortcut({
			id: 'pwa',
			name: 'ChatGPT',
			originalFilename: 'chrome.exe',
			productName: 'Google Chrome Beta',
			publisher: 'Google LLC',
		}),
		forbidden: ['chrome-beta', 'chrome beta', 'chromebeta', 'chrome'],
	},
	{
		label: 'Edge WebView2 runtime',
		record: app({
			id: 'webview',
			name: 'Microsoft Edge WebView2 Runtime',
			path: String.raw`C:\Program Files (x86)\Microsoft\EdgeWebView\Application\140.0.0.0\msedgewebview2.exe`,
			productName: 'Microsoft Edge WebView2',
			publisher: 'Microsoft Corporation',
		}),
		forbidden: ['edge', 'msedge', 'webview2', 'webview'],
		noExternalEntry: true,
	},
	{
		label: 'Electron-hosted app carrying Electron metadata',
		record: shortcut({
			id: 'electron-app',
			name: 'Acme Notes',
			originalFilename: 'electron.exe',
			productName: 'Electron',
			publisher: 'GitHub, Inc.',
		}),
		forbidden: ['electron', 'electronjs'],
	},
	{
		label: 'Java-hosted app launched through javaw.exe',
		record: app({
			id: 'java-app',
			name: 'Acme Ledger',
			path: String.raw`C:\Program Files\Java\jre-21\bin\javaw.exe`,
			productName: 'Java(TM) Platform SE 21',
			publisher: 'Oracle Corporation',
		}),
		forbidden: ['java', 'jre', 'jdk', 'javaw', 'openjdk'],
	},
	{
		label: 'Python-hosted script launched through pythonw.exe',
		record: app({
			id: 'py-app',
			name: 'Build Tool',
			path: String.raw`C:\Users\me\AppData\Local\Programs\Python\Python312\pythonw.exe`,
			productName: 'Python',
			publisher: 'Python Software Foundation',
		}),
		forbidden: ['python', 'python3', 'python312', 'pythonw'],
	},
	{
		label: 'Node-hosted tool launched through node.exe',
		record: app({
			id: 'node-app',
			name: 'Acme Sync',
			path: String.raw`C:\Program Files\nodejs\node.exe`,
			productName: 'Node.js',
			publisher: 'Node.js Foundation',
		}),
		forbidden: ['node', 'nodejs', 'node.js', 'npm', 'npx'],
	},
	{
		label: 'installer artifact in Downloads',
		record: app({
			id: 'installer',
			name: 'Proton VPN',
			path: String.raw`D:\Downloads\ProtonVPN_v4.2.1.exe`,
			productName: 'Proton VPN',
			publisher: 'Proton AG',
			artifactKind: 'installer',
		}),
		forbidden: ['protonvpn', 'proton vpn'],
		noExternalEntry: true,
	},
	{
		label: 'updater of a known package',
		record: app({
			id: 'updater',
			name: 'Google Update',
			path: String.raw`C:\Program Files (x86)\Google\Update\GoogleUpdate.exe`,
			productName: 'Google Update',
			publisher: 'Google LLC',
		}),
		forbidden: ['googleupdate', 'google update', 'chrome'],
		noExternalEntry: true,
	},
	{
		label: 'service of a known package',
		record: app({
			id: 'service',
			name: 'Tailscale Service',
			path: String.raw`C:\Program Files\Tailscale\tailscaled.exe`,
			productName: 'Tailscale',
			publisher: 'Tailscale Inc.',
		}),
		forbidden: ['tailscale'],
		noExternalEntry: true,
	},
	{
		label: 'agent of a known package',
		record: app({
			id: 'agent',
			name: 'Amazon SSM Agent',
			path: String.raw`C:\Program Files\Amazon\SSM\amazon-ssm-agent.exe`,
			productName: 'Amazon SSM Agent',
			publisher: 'Amazon Web Services',
		}),
		forbidden: ['ssmagent', 'ssm'],
		noExternalEntry: true,
	},
	{
		label: 'SDK helper executable',
		record: app({
			id: 'sdk-helper',
			name: 'NVIDIA FrameView SDK',
			path: String.raw`C:\Program Files\NVIDIA Corporation\FrameViewSDK\bin\nvfvsdksvc_x64.exe`,
			productName: 'NVIDIA FrameView SDK',
			publisher: 'NVIDIA Corporation',
		}),
		forbidden: ['nvidia', 'frameview', 'frameviewsdk'],
		noExternalEntry: true,
	},
	{
		label: 'driver helper',
		record: app({
			id: 'driver-helper',
			name: 'Intel Driver & Support Assistant Updater',
			path: String.raw`C:\Program Files (x86)\Intel\Driver and Support Assistant\DSAUpdateService.exe`,
			productName: 'Intel Driver & Support Assistant',
			publisher: 'Intel',
		}),
		forbidden: ['intel-dsa', 'inteldriverandsupportassistant'],
		noExternalEntry: true,
	},
	{
		label: 'setup of a known package',
		record: shortcut({
			id: 'setup',
			name: 'Microsoft OneDrive Setup',
			originalFilename: 'OneDriveSetup.exe',
			productName: 'Microsoft OneDrive',
			publisher: 'Microsoft Corporation',
		}),
		forbidden: ['onedrive', 'one drive'],
		noExternalEntry: true,
	},
	{
		label: 'same publisher, unrelated product',
		record: shortcut({
			id: 'sibling',
			name: 'Google Earth Pro',
			originalFilename: 'googleearth.exe',
			productName: 'Google Earth Pro',
			publisher: 'Google LLC',
		}),
		forbidden: ['gcloud', 'gsutil', 'chrome-beta', 'adb', 'fastboot'],
	},
	{
		label: 'generic name shared by many packages',
		record: msix({
			id: 'generic',
			name: 'Notes',
			family: 'Acme.Notes_abc123',
			productName: 'Acme.Notes',
			publisher: 'Acme',
		}),
		forbidden: ['notes', 'note', 'sticky notes'],
	},
]

describe('external alias negative corpus', () => {
	beforeAll(async () => {
		await loadKnownPackageIndex()
	})

	it.each(ROWS.map(row => [row.label, row]))('%s', (_label, row) => {
		const aliases = resolveSearchAliases(row.record).map(
			alias => alias.value,
		)
		for (const value of row.forbidden)
			expect(aliases, `${row.record.name} owns ${value}`).not.toContain(
				value,
			)
		if (row.noExternalEntry)
			expect(
				matchedKnownEntries(row.record).filter(
					match => match.entry.source === 'external',
				),
			).toEqual([])
	})

	it('never lets a hosted record outrank the real package for the host alias', () => {
		const pwa = ROWS[0]!.record
		const ranked = rankAppsByQuery(
			[...EXTERNAL_ONLY, pwa],
			'chrome-beta',
		).map(entry => entry.id)
		expect(ranked[0]).toBe('chrome-beta')
		expect(ranked).not.toContain('pwa')
	})

	it('never grants a strong confidence from the external corpus', () => {
		for (const record of EXTERNAL_ONLY) {
			const external = matchedKnownEntries(record).filter(
				match => match.entry.source === 'external',
			)
			for (const match of external)
				for (const [, confidence] of match.entry.aliases)
					expect(confidence).not.toBe('strong')
		}
	})
})
