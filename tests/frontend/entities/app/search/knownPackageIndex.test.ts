import { afterEach, describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { fieldsFor } from '../../../../../src/entities/app/lib/search/searchFields'
import {
	decodeKnownPackageIndex,
	installKnownPackageEntries,
	knownPackageGeneration,
	knownPackageIndexStatus,
	loadKnownPackageIndex,
	subscribeKnownPackageIndex,
} from '../../../../../src/entities/app/lib/search/knownPackageIndex'
import { resolveSearchAliases } from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import type {
	KnownAppAliasEntry,
	KnownPackageIndexData,
} from '../../../../../src/entities/app/lib/search/types'
import { app, msix, shortcut } from './fixtures/app'

const strings = [
	'Acme.SuperEditor',
	'acme super editor',
	'supereditor.exe',
	'acme',
	'acme.supereditor_8wekyb3d8bbwe',
	'sedit',
	'superedit',
	'Microsoft.VisualStudioCode',
	'visual studio code',
	'microsoft',
	'vscode',
]

const sample: KnownPackageIndexData = {
	version: 1,
	source: 'test',
	commit: 'test',
	generator: 1,
	strings,
	records: [
		[0, [1], [1], [3], [4], [2], [5, 0, 6, 1]],
		[7, [8], [], [9], [], [], [10, 0]],
	],
}

const aliasesOf = (record: ReturnType<typeof app>) =>
	new Map(
		resolveSearchAliases(record).map(alias => [
			alias.value,
			alias.confidence,
		]),
	)

afterEach(() => {
	installKnownPackageEntries([])
})

describe('known package index', () => {
	it('decodes records into external entries with family, executable+publisher and name+publisher clauses plus a name-only fallback', () => {
		const entries = decodeKnownPackageIndex(sample)
		expect(entries.map(entry => entry.id)).toEqual([
			'winget:Acme.SuperEditor',
			'winget:Microsoft.VisualStudioCode',
		])
		expect(entries[0]!.source).toBe('external')
		expect(entries[0]!.match.anyOf).toEqual([
			{ packageFamily: ['acme.supereditor_8wekyb3d8bbwe'] },
			{
				allOf: [
					{ executable: ['supereditor.exe'] },
					{ publisherContains: ['acme'] },
				],
			},
			{
				allOf: [
					{ name: ['acme super editor'] },
					{ publisherContains: ['acme'] },
				],
			},
		])
		expect(entries[0]!.match.nameOnly).toEqual(['acme super editor'])
		expect(entries[1]!.match.nameOnly).toBeUndefined()
		expect(entries[0]!.aliases).toEqual([
			['sedit', 'normal'],
			['superedit', 'weak'],
		])
	})

	it('ignores an index of another version or a malformed one', () => {
		expect(decodeKnownPackageIndex({ ...sample, version: 2 })).toEqual([])
		expect(
			decodeKnownPackageIndex({
				...sample,
				records:
					undefined as unknown as KnownPackageIndexData['records'],
			}),
		).toEqual([])
	})

	it('gives an external-only app its aliases at normal or weak, never strong', () => {
		installKnownPackageEntries(decodeKnownPackageIndex(sample))
		const editor = app({
			id: 'se',
			name: 'Acme Super Editor 4.2',
			path: String.raw`C:\Acme\SuperEditor.exe`,
			publisher: 'Acme Corp',
		})
		const aliases = aliasesOf(editor)
		expect(aliases.get('sedit')).toBe('normal')
		expect(aliases.get('superedit')).toBe('weak')
		expect([...aliases.values()]).not.toContain('strong')
		expect(
			aliasesOf(
				msix({
					id: 'm',
					name: 'Super Editor',
					family: 'Acme.SuperEditor_8wekyb3d8bbwe',
					productName: 'Acme.SuperEditor',
				}),
			).get('sedit'),
		).toBe('normal')
	})

	it('lets the curated dictionary win over an external record for the same value', () => {
		installKnownPackageEntries([
			...decodeKnownPackageIndex(sample),
			{
				id: 'winget:probe',
				source: 'external',
				match: { anyOf: [{ name: ['visual studio code'] }] },
				aliases: [
					['vscode', 'normal'],
					['vsc', 'normal'],
					['blocked-one', 'normal'],
				],
			},
		])
		const vscode = shortcut({
			id: 'code',
			name: 'Visual Studio Code',
			originalFilename: 'electron.exe',
			productName: 'Visual Studio Code',
			publisher: 'Microsoft Corporation',
		})
		const aliases = aliasesOf(vscode)
		expect(aliases.get('vscode')).toBe('strong')
		expect(aliases.get('vsc')).toBe('weak')
		expect(aliases.get('blocked-one')).toBe('normal')
	})

	it('drops an external alias a matched curated entry blocks', () => {
		const curated: KnownAppAliasEntry = {
			id: 'probe-curated',
			match: { anyOf: [{ name: ['probe app'] }] },
			aliases: [['probe', 'normal']],
			blockedAliases: ['bad-alias'],
		}
		installKnownPackageEntries([
			curated,
			{
				id: 'winget:probe',
				source: 'external',
				match: { anyOf: [{ name: ['probe app'] }] },
				aliases: [
					['bad-alias', 'normal'],
					['fine-alias', 'normal'],
				],
			},
		])
		const aliases = aliasesOf(app({ id: 'p', name: 'Probe App' }))
		expect(aliases.has('bad-alias')).toBe(false)
		expect(aliases.get('fine-alias')).toBe('normal')
	})

	it('never hands an external alias to a helper or host record', () => {
		installKnownPackageEntries(decodeKnownPackageIndex(sample))
		const updater = app({
			id: 'up',
			name: 'Acme Super Editor Update',
			path: String.raw`C:\Acme\Update.exe`,
			publisher: 'Acme Corp',
		})
		expect(aliasesOf(updater).has('sedit')).toBe(false)
		const pwa = shortcut({
			id: 'pwa',
			name: 'Acme Super Editor',
			originalFilename: 'chrome.exe',
			productName: 'Google Chrome',
			publisher: 'Google LLC',
		})
		expect(aliasesOf(pwa).get('sedit')).toBe('weak')
		expect(aliasesOf(pwa).has('google chrome')).toBe(false)
	})

	it('invalidates cached search fields when a new index is installed', () => {
		const record = app({
			id: 'se',
			name: 'Acme Super Editor',
			publisher: 'Acme',
		})
		expect(fieldsFor(record).aliasExact.has('sedit')).toBe(false)
		const before = knownPackageGeneration()
		installKnownPackageEntries(decodeKnownPackageIndex(sample))
		expect(knownPackageGeneration()).toBe(before + 1)
		expect(fieldsFor(record).aliasExact.get('sedit')).toBe('normal')
	})

	it('caps a name-only external match at weak until corroborating identity arrives', () => {
		installKnownPackageEntries(decodeKnownPackageIndex(sample))
		const bare = app({ id: 'se', name: 'Acme Super Editor' })
		expect(aliasesOf(bare).get('sedit')).toBe('weak')
		expect(aliasesOf(bare).get('superedit')).toBe('weak')
		const hydrated = { ...bare, publisher: 'Acme Corp' }
		expect(aliasesOf(hydrated).get('sedit')).toBe('normal')
		expect(aliasesOf(hydrated).get('superedit')).toBe('weak')
	})

	it('never lets an unrelated local application with the same display name reach normal', () => {
		installKnownPackageEntries(decodeKnownPackageIndex(sample))
		const unrelated = app({
			id: 'other',
			name: 'Acme Super Editor',
			path: String.raw`C:\Other\editor.exe`,
			publisher: 'Other Vendor Ltd',
		})
		const aliases = aliasesOf(unrelated)
		expect(aliases.get('sedit')).toBe('weak')
		expect([...aliases.values()]).not.toContain('normal')
	})

	it('treats a same-name package of another publisher as weak evidence only', () => {
		installKnownPackageEntries([
			{
				id: 'winget:AcmeA.AcmeSync',
				source: 'external',
				match: {
					anyOf: [
						{
							allOf: [
								{ name: ['acme sync'] },
								{ publisherContains: ['acme a'] },
							],
						},
					],
					nameOnly: ['acme sync'],
				},
				aliases: [
					['acmesync', 'normal'],
					['async-cli', 'normal'],
				],
			},
		])
		const local = app({
			id: 'local',
			name: 'Acme Sync',
			path: String.raw`C:\Vendor B\sync.exe`,
			publisher: 'Vendor B Ltd',
		})
		const aliases = aliasesOf(local)
		expect(aliases.get('acmesync')).toBe('weak')
		expect(aliases.get('async-cli')).toBe('weak')
		expect(
			aliasesOf({ ...local, publisher: 'Acme A Inc.' }).get('acmesync'),
		).toBe('normal')
		const literal = app({ id: 'literal', name: 'Acmesync' })
		expect(
			rankAppsByQuery([local, literal], 'acmesync').map(
				entry => entry.id,
			),
		).toEqual(['literal', 'local'])
	})

	it('ranks a literal name above another record that only carries the value as a weak external alias', () => {
		installKnownPackageEntries([
			{
				id: 'winget:Vendor.Rtss',
				source: 'external',
				match: { anyOf: [], nameOnly: ['vendor stats tool'] },
				aliases: [['rtss', 'normal']],
			},
		])
		const literal = app({ id: 'literal', name: 'RTSS' })
		const aliased = app({ id: 'aliased', name: 'Vendor Stats Tool' })
		expect(aliasesOf(aliased).get('rtss')).toBe('weak')
		expect(
			rankAppsByQuery([aliased, literal], 'rtss').map(entry => entry.id),
		).toEqual(['literal', 'aliased'])
	})

	it('tolerates malformed records and string references without throwing', () => {
		const malformed = {
			...sample,
			strings: [...strings],
			records: [
				[0, [1], [1], [3], [4], [2], [5, 0, 99, 1]],
				[99, [1], [], [3], [], [], [5, 0]],
				'garbage',
				[7, 'x', [], [9], [], [], [10, 0]],
				[7, [8], [], [9], [], [], 'x'],
			] as unknown as KnownPackageIndexData['records'],
		}
		const entries = decodeKnownPackageIndex(malformed)
		expect(entries.map(entry => entry.id)).toEqual([
			'winget:Acme.SuperEditor',
		])
		expect(entries[0]!.aliases).toEqual([['sedit', 'normal']])
		expect(
			decodeKnownPackageIndex(null as unknown as KnownPackageIndexData),
		).toEqual([])
		expect(
			decodeKnownPackageIndex({
				...sample,
				strings: 'nope' as unknown as string[],
			}),
		).toEqual([])
	})

	it('notifies subscribers and reports its status on every install', () => {
		const seen: number[] = []
		const stop = subscribeKnownPackageIndex(() =>
			seen.push(knownPackageGeneration()),
		)
		const before = knownPackageGeneration()
		installKnownPackageEntries(decodeKnownPackageIndex(sample))
		expect(knownPackageIndexStatus()).toBe('ready')
		installKnownPackageEntries([])
		expect(knownPackageIndexStatus()).toBe('failed')
		stop()
		installKnownPackageEntries(decodeKnownPackageIndex(sample))
		expect(seen).toEqual([before + 1, before + 2])
	})

	it('loads the shipped index once and keeps search working if it is missing', async () => {
		await loadKnownPackageIndex()
		await loadKnownPackageIndex()
		const record = app({
			id: 'x',
			name: 'Whatever Tool',
			path: String.raw`C:\W\whatever.exe`,
		})
		expect(
			resolveSearchAliases(record).map(alias => alias.value),
		).toContain('whatever')
	})
})
