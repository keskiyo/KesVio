import { describe, expect, it } from 'vitest'
import { generateAppAliases } from '../../../../../src/entities/app/lib/search/generatedAliases'
import {
	stripKnownVendorPrefix,
	stripTrailingVersion,
} from '../../../../../src/entities/app/lib/search/aliasText'
import type { AppInfo } from '../../../../../src/entities/app'
import { app, msix, shortcut } from './fixtures/app'

const values = (info: AppInfo) =>
	generateAppAliases(info).map(alias => alias.value)

describe('generateAppAliases', () => {
	it('derives the executable name and its stem from a real launch path', () => {
		expect(
			values(
				app({
					id: 'code',
					name: 'Visual Studio Code',
					path: String.raw`C:\Program Files\Microsoft VS Code\Code.exe`,
					originalFilename: 'Code.exe',
				}),
			),
		).toEqual(expect.arrayContaining(['code.exe', 'code']))
	})

	// The original file name is metadata about whatever executable hydration read, which for a
	// PWA or an Electron app is the host. It is never an alias source on its own.
	it.each([
		['ChatGPT', 'chrome.exe', 'chrome'],
		['Visual Studio Code', 'electron.exe', 'electron'],
		['Some Tool', 'obs64.exe', 'obs'],
		['Command Prompt', 'Cmd.Exe.MUI', 'cmd'],
	])(
		'%s with originalFilename %s does not generate %s',
		(name, originalFilename, forbidden) => {
			const aliases = values(
				shortcut({ id: name, name, originalFilename, publisher: 'X' }),
			)
			expect(aliases).not.toContain(forbidden)
			expect(aliases).not.toContain(originalFilename.toLocaleLowerCase())
		},
	)

	it('does not derive an alias from a shortcut file name or an AppUserModelID', () => {
		expect(
			values(
				shortcut({
					id: 'foo',
					name: 'Some Product',
					originalFilename: null,
				}),
			),
		).not.toEqual(expect.arrayContaining(['some product.lnk', 'foo']))
		expect(
			values(
				msix({
					id: 'store',
					name: 'Windows Terminal',
					family: 'Microsoft.WindowsTerminal_8wekyb3d8bbwe',
					productName: 'Microsoft.WindowsTerminal',
				}),
			),
		).not.toEqual(expect.arrayContaining(['app', 'microsoft']))
	})

	it.each([
		['obs64.exe', ['obs64', 'obs']],
		['idea64.exe', ['idea64', 'idea']],
		['app32.exe', ['app32']],
	])('strips only an architecture suffix from %s', (file, expected) => {
		const aliases = values(
			app({ id: 'x', name: 'Some Tool', path: `C:\\Tools\\${file}` }),
		)
		expect(aliases).toEqual(expect.arrayContaining(expected))
		expect(aliases).not.toContain('app')
	})

	it('never turns 7zip into zip or strips arbitrary digits', () => {
		const aliases = values(
			app({
				id: '7z',
				name: '7-Zip',
				path: String.raw`C:\7-Zip\7zFM.exe`,
			}),
		)
		expect(aliases).toContain('7zfm')
		expect(aliases).not.toContain('zip')
		expect(aliases).not.toContain('-zip')
	})

	it.each(['chrome_proxy.exe', 'electron.exe', 'setup.exe', 'Update.exe'])(
		'skips the host or helper executable %s',
		file => {
			const aliases = values(
				app({
					id: 'x',
					name: 'Some Product',
					path: `C:\\Tools\\${file}`,
				}),
			)
			expect(aliases).not.toContain(file.toLocaleLowerCase())
			expect(aliases).not.toContain(
				file.toLocaleLowerCase().replace(/\.exe$/, ''),
			)
		},
	)

	it('adds a product name that differs from the display name', () => {
		expect(
			values(
				app({
					id: 'vscode',
					name: 'Microsoft Visual Studio Code',
					productName: 'Visual Studio Code',
				}),
			),
		).toContain('visual studio code')
	})

	it('does not hand a helper record its product name', () => {
		expect(
			values(
				app({
					id: 'discord-update',
					name: 'Discord Update',
					path: String.raw`C:\Discord\Update.exe`,
					productName: 'Discord',
				}),
			),
		).not.toContain('discord')
	})

	it('drops a known vendor prefix only down to a single specific word', () => {
		expect(values(app({ id: 'ps', name: 'Adobe Photoshop 2024' }))).toEqual(
			expect.arrayContaining(['adobe photoshop', 'photoshop']),
		)
		expect(values(app({ id: 'chrome', name: 'Google Chrome' }))).toContain(
			'chrome',
		)
		expect(
			values(app({ id: 'nvcpl', name: 'NVIDIA Control Panel' })),
		).not.toContain('control panel')
		expect(values(app({ id: 'amd', name: 'AMD Software' }))).not.toContain(
			'software',
		)
		expect(
			values(app({ id: 'tc', name: 'Total Commander' })),
		).not.toContain('commander')
	})

	it('offers an acronym only as a weak alias of three to eight letters', () => {
		const aoe = generateAppAliases(
			app({ id: 'aoe', name: 'Age of Empires' }),
		)
		expect(aoe).toContainEqual({ value: 'aoe', confidence: 'weak' })
		expect(values(app({ id: 'as', name: 'Android Studio' }))).not.toContain(
			'as',
		)
	})

	it.each([
		['World of Warcraft', 'wow'],
		['Call of Duty', 'cod'],
		['League of Legends', 'lol'],
	])('offers %s as %s', (name, acronym) => {
		expect(generateAppAliases(app({ id: name, name }))).toContainEqual({
			value: acronym,
			confidence: 'weak',
		})
	})

	it.each([
		'SQL Server Management Studio',
		'Battle.net Update Agent',
		'Adobe Creative Cloud Helper',
		'Google Update Setup',
	])('does not build an acronym from generic words in %s', name => {
		expect(
			generateAppAliases(app({ id: name, name })).filter(
				alias => alias.confidence === 'weak',
			),
		).toEqual([])
	})

	it('ignores an operating-system product name', () => {
		expect(
			values(
				app({
					id: 'appverif',
					name: 'Application Verifier (X64)',
					productName: 'Microsoft® Windows® Operating System',
				}),
			),
		).not.toContain('microsoft® windows® operating system')
	})

	it('keeps names with punctuation intact', () => {
		for (const name of ['C++ Builder', 'Notepad++', 'Node.js', '7-Zip'])
			expect(values(app({ id: name, name }))).not.toContain(
				name.toLocaleLowerCase().replace(/[^a-z0-9 ]/g, ''),
			)
	})

	it('skips a purely numeric executable stem and a mixed-script acronym', () => {
		expect(
			values(
				app({
					id: 'crypto',
					name: 'Крипто 4',
					path: String.raw`C:\CryptoPro\32.exe`,
				}),
			),
		).not.toEqual(expect.arrayContaining(['32', '32.exe']))
		expect(
			generateAppAliases(
				app({ id: 'lo', name: 'LibreOffice (Безопасный режим)' }),
			).filter(alias => alias.confidence === 'weak'),
		).toEqual([])
	})

	it('gives an installer artifact only its versionless name', () => {
		expect(
			values(
				app({
					id: 'fz',
					name: 'FileZilla 3.69',
					path: String.raw`D:\Downloads\filezilla_3.69.6_win64-setup.exe`,
					productName: 'FileZilla',
					artifactKind: 'installer',
				}),
			),
		).toEqual(['filezilla'])
	})

	it('never reads the description', () => {
		expect(
			values(
				app({
					id: 'd',
					name: 'Some Tool',
					description: 'The best torrent vpn browser',
				}),
			),
		).toEqual(expect.not.arrayContaining(['torrent', 'vpn', 'browser']))
	})
})

describe('stripTrailingVersion', () => {
	it.each([
		['postgresql 17', 'postgresql'],
		['7-zip 25.01', '7-zip'],
		['7-zip', '7-zip'],
		['visual studio 2022', 'visual studio'],
		['python 3.12 (64-bit)', 'python'],
		['node.js', 'node.js'],
		[
			'windows 11 installation assistant',
			'windows 11 installation assistant',
		],
	])('%s -> %s', (name, expected) => {
		expect(stripTrailingVersion(name)).toBe(expected)
	})
})

describe('stripKnownVendorPrefix', () => {
	it.each([
		['microsoft visual studio code', 'visual studio code'],
		['google chrome', 'chrome'],
		['mozilla firefox', 'firefox'],
		['jetbrains intellij idea', 'intellij idea'],
		['total commander', 'total commander'],
		['microsoft', 'microsoft'],
	])('%s -> %s', (name, expected) => {
		expect(stripKnownVendorPrefix(name)).toBe(expected)
	})
})
