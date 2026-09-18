import { describe, expect, it } from 'vitest'
import {
	normalizeIdentityFact,
	normalizeSearchAlias,
} from '../../../../../src/entities/app/lib/search/aliasText'
import { isHelperRecord } from '../../../../../src/entities/app/lib/search/helperRecords'
import {
	appMatchFacts,
	clauseStrengthCeiling,
	matchKnownEntry,
} from '../../../../../src/entities/app/lib/search/knownAliasMatch'
import type {
	KnownAppAliasEntry,
	MatchClause,
} from '../../../../../src/entities/app/lib/search/types'
import { app, msix, shortcut } from './fixtures/app'

function entry(
	anyOf: MatchClause[],
	exclude?: MatchClause[],
): KnownAppAliasEntry {
	return {
		id: 'probe',
		match: { anyOf, ...(exclude ? { exclude } : {}) },
		aliases: [['probe', 'strong']],
	}
}

const strength = (
	info: ReturnType<typeof app>,
	anyOf: MatchClause[],
	exclude?: MatchClause[],
) => matchKnownEntry(entry(anyOf, exclude), appMatchFacts(info))

describe('identity clauses', () => {
	const exe = app({
		id: 'x',
		name: 'Some Tool 2024',
		path: String.raw`C:\Tools\tool.exe`,
		productName: 'Some Tool',
		publisher: 'Some Vendor Inc.',
		originalFilename: 'tool.exe',
	})

	it('treats a package family, a Steam app id and a launch executable as strong identity', () => {
		expect(
			strength(
				msix({
					id: 'm',
					name: 'M',
					family: 'Vendor.App_abc123',
					productName: 'Vendor.App',
				}),
				[{ packageFamily: ['vendor.app_abc123'] }],
			),
		).toBe('strong')
		expect(
			strength(
				app({ id: 's', name: 'S', path: 'steam://rungameid/730' }),
				[{ steamAppId: ['730'] }],
			),
		).toBe('strong')
		expect(strength(exe, [{ executable: ['tool.exe'] }])).toBe('strong')
	})

	it('treats an exact product name or display name as normal identity', () => {
		expect(strength(exe, [{ productName: ['some tool'] }])).toBe('normal')
		expect(strength(exe, [{ name: ['some tool'] }])).toBe('normal')
		expect(strength(exe, [{ name: ['some tool 2024'] }])).toBe('normal')
	})

	it('never matches on a publisher, an original file name or a name prefix alone', () => {
		expect(strength(exe, [{ publisherContains: ['some vendor'] }])).toBe(
			'none',
		)
		expect(strength(exe, [{ originalFilename: ['tool.exe'] }])).toBe('none')
		expect(strength(exe, [{ nameStartsWith: ['some'] }])).toBe('none')
		expect(strength(exe, [{ productNameStartsWith: ['some'] }])).toBe(
			'none',
		)
		expect(
			strength(exe, [
				{
					allOf: [
						{ publisherContains: ['some vendor'] },
						{ originalFilename: ['tool.exe'] },
					],
				},
			]),
		).toBe('none')
	})

	it('promotes an identity by one level when a supporting clause also matches', () => {
		const shortcutRecord = shortcut({
			id: 'l',
			name: 'Some Tool',
			originalFilename: 'tool.exe',
			productName: 'Some Tool',
			publisher: 'Some Vendor Inc.',
		})
		expect(
			strength(shortcutRecord, [
				{
					allOf: [
						{ name: ['some tool'] },
						{ originalFilename: ['tool.exe'] },
					],
				},
			]),
		).toBe('strong')
		expect(
			strength(shortcutRecord, [
				{
					allOf: [
						{ productName: ['some tool'] },
						{ publisherContains: ['some vendor'] },
					],
				},
			]),
		).toBe('strong')
		expect(
			strength(shortcutRecord, [
				{
					allOf: [
						{ nameStartsWith: ['some'] },
						{ publisherContains: ['some vendor'] },
					],
				},
			]),
		).toBe('normal')
		expect(
			strength(shortcutRecord, [
				{
					allOf: [
						{ nameStartsWith: ['some'] },
						{ publisherContains: ['some vendor'] },
						{ originalFilename: ['tool.exe'] },
					],
				},
			]),
		).toBe('normal')
	})

	it('fails an allOf when any member misses and takes the best anyOf branch', () => {
		expect(
			strength(exe, [
				{
					allOf: [
						{ name: ['some tool'] },
						{ publisherContains: ['other'] },
					],
				},
			]),
		).toBe('none')
		expect(
			strength(exe, [
				{ name: ['some tool'] },
				{ executable: ['tool.exe'] },
			]),
		).toBe('strong')
	})

	it('vetoes the entry when an exclude clause matches, even a supporting one', () => {
		expect(
			strength(
				exe,
				[{ executable: ['tool.exe'] }],
				[{ name: ['some tool'] }],
			),
		).toBe('none')
		expect(
			strength(
				exe,
				[{ executable: ['tool.exe'] }],
				[{ originalFilename: ['tool.exe'] }],
			),
		).toBe('none')
		expect(
			strength(
				exe,
				[{ executable: ['tool.exe'] }],
				[{ publisherContains: ['some vendor'] }],
			),
		).toBe('none')
	})

	it('reports the strongest strength a clause can ever yield', () => {
		expect(clauseStrengthCeiling({ executable: ['a.exe'] })).toBe('strong')
		expect(clauseStrengthCeiling({ name: ['a'] })).toBe('normal')
		expect(clauseStrengthCeiling({ publisherContains: ['a'] })).toBe('none')
		expect(clauseStrengthCeiling({ nameStartsWith: ['a'] })).toBe('none')
		expect(
			clauseStrengthCeiling({
				allOf: [{ name: ['a'] }, { publisherContains: ['a'] }],
			}),
		).toBe('strong')
		expect(
			clauseStrengthCeiling({
				allOf: [
					{ nameStartsWith: ['a'] },
					{ publisherContains: ['a'] },
				],
			}),
		).toBe('normal')
		expect(
			clauseStrengthCeiling({
				allOf: [
					{ nameStartsWith: ['a'] },
					{ productNameStartsWith: ['a'] },
				],
			}),
		).toBe('none')
	})
})

describe('helper records', () => {
	it.each([
		['Discord Update', String.raw`C:\Discord\Update.exe`],
		['Battle.net Update Agent', String.raw`C:\Agent\Agent.exe`],
		['Steam Client Bootstrapper', String.raw`C:\Steam\steam.exe`],
		[
			'Microsoft Edge WebView2 Runtime',
			String.raw`C:\Edge\msedgewebview2.exe`,
		],
		['Visual Studio Installer', String.raw`C:\VS\vs_installer.exe`],
		['Code Tunnel', String.raw`C:\Code\code-tunnel.exe`],
		['YouTube', String.raw`C:\Chrome\chrome_proxy.exe`],
	])('%s never receives a dictionary entry', (name, path) => {
		expect(
			isHelperRecord(appMatchFacts(app({ id: name, name, path }))),
		).toBe(true)
	})

	it.each([
		'Epic Games Launcher',
		'Minecraft Launcher',
		'Java(TM) SE Runtime Environment 21',
		'Quick Assist',
	])('%s is a product, not a helper', name => {
		expect(isHelperRecord(appMatchFacts(app({ id: name, name })))).toBe(
			false,
		)
	})

	// Findings of the live-catalog audit: an SFX installer named "7-Zip" in Downloads matched the
	// 7-Zip entry through its product metadata, an "Uninstall Telegram" shortcut matched Telegram,
	// and versioned setup files handed out their file names as aliases.
	it.each([
		[
			'an installer artifact',
			app({
				id: 'sfx',
				name: '7-Zip',
				path: String.raw`D:\Downloads\supermium_122_64_setup.exe`,
				productName: '7-Zip',
				publisher: 'Igor Pavlov',
				artifactKind: 'installer',
			}),
		],
		[
			'a documentation artifact',
			app({
				id: 'docs',
				name: 'Python 3.14 Module Docs (64-bit)',
				publisher: 'Python Software Foundation',
				artifactKind: 'documentation',
			}),
		],
		[
			'a setup executable in the launch path',
			app({
				id: 'fz',
				name: 'FileZilla',
				path: String.raw`D:\Downloads\filezilla_3.69.6_win64-setup.exe`,
			}),
		],
		[
			'a setup executable in the original file name',
			shortcut({
				id: 'od',
				name: 'Microsoft OneDrive',
				originalFilename: 'OneDriveSetup.exe',
			}),
		],
		[
			'a Russian uninstall shortcut',
			shortcut({
				id: 'tg-un',
				name: 'Деинсталлировать Telegram',
				originalFilename: 'Uninstall.exe',
				productName: 'Telegram Desktop',
				publisher: 'Telegram FZ-LLC',
			}),
		],
	])('treats %s as a helper record', (_label, record) => {
		expect(isHelperRecord(appMatchFacts(record))).toBe(true)
	})
})

describe('normalization', () => {
	it('keeps meaningful punctuation in a searchable alias', () => {
		for (const value of ['C++', 'Notepad++', 'Node.js', '7-Zip'])
			expect(normalizeSearchAlias(value)).toBe(value.toLocaleLowerCase())
		expect(normalizeSearchAlias('  Visual   Studio ')).toBe('visual studio')
	})

	it('strips marks, folds smart dashes and NBSP for identity facts', () => {
		expect(
			normalizeIdentityFact('Microsoft® Windows® Operating System'),
		).toBe('microsoft windows operating system')
		expect(normalizeIdentityFact('7‑Zip\u00a0File Manager')).toBe(
			'7-zip file manager',
		)
		expect(normalizeIdentityFact('Ｃｏｄｅ')).toBe('code')
		expect(normalizeIdentityFact('Node.js')).toBe('node.js')
	})

	it('reads identity facts from the record without touching the original file name as an executable', () => {
		const facts = appMatchFacts(
			shortcut({
				id: 'c',
				name: 'ChatGPT',
				originalFilename: 'chrome.exe',
				publisher: 'OpenAI',
			}),
		)
		expect(facts.pathExecutable).toBeNull()
		expect(facts.originalFilename).toBe('chrome.exe')
		expect(facts.packageFamily).toBeNull()
		expect(facts.steamAppId).toBeNull()
		expect(facts.names).toEqual(['chatgpt'])
	})

	it('reads a versionless name, a package family and a Steam id', () => {
		expect(
			appMatchFacts(app({ id: 'a', name: 'PostgreSQL 17' })).names,
		).toEqual(['postgresql 17', 'postgresql'])
		expect(
			appMatchFacts(
				msix({
					id: 'm',
					name: 'Terminal',
					family: 'Microsoft.WindowsTerminal_8wekyb3d8bbwe',
					productName: 'Microsoft.WindowsTerminal',
				}),
			).packageFamily,
		).toBe('microsoft.windowsterminal_8wekyb3d8bbwe')
		expect(
			appMatchFacts(
				app({ id: 's', name: 'Dota 2', path: 'steam://rungameid/570' }),
			).steamAppId,
		).toBe('570')
	})
})
