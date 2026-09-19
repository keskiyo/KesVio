import { describe, expect, it } from 'vitest'
import {
	filterAppsByQuery,
	rankAppsByQuery,
	rankAppsByQueryTop,
} from '../../../../../src/entities/app/lib/catalogSearch'
import { resolveSearchAliases } from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import { SEARCH_SCORE } from '../../../../../src/entities/app/lib/search/scoring'
import { app, ids, msix, shortcut } from './fixtures/app'

const vscode = app({
	id: 'vscode',
	name: 'Visual Studio Code',
	path: String.raw`C:\Users\me\AppData\Local\Programs\Microsoft VS Code\Code.exe`,
	productName: 'Visual Studio Code',
	publisher: 'Microsoft Corporation',
})
const visualStudio = app({
	id: 'vs',
	name: 'Visual Studio 2022',
	path: String.raw`C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\devenv.exe`,
	publisher: 'Microsoft Corporation',
})
const codeBlocks = app({
	id: 'codeblocks',
	name: 'CodeBlocks',
	path: String.raw`C:\CodeBlocks\codeblocks.exe`,
})
const commandPrompt = app({
	id: 'cmd',
	name: 'Command Prompt',
	path: String.raw`C:\Windows\System32\cmd.exe`,
})
const gitCmd = app({ id: 'git-cmd', name: 'Git CMD' })
const terminal = msix({
	id: 'wt',
	name: 'Terminal',
	family: 'Microsoft.WindowsTerminal_8wekyb3d8bbwe',
	productName: 'Microsoft.WindowsTerminal',
})
const docker = app({
	id: 'docker',
	name: 'Docker Desktop',
	path: String.raw`C:\Program Files\Docker\Docker\Docker Desktop.exe`,
})
const telegram = app({
	id: 'telegram',
	name: 'Telegram Desktop',
	path: String.raw`C:\Users\me\AppData\Roaming\Telegram Desktop\Telegram.exe`,
})
const obs = app({
	id: 'obs',
	name: 'OBS Studio',
	path: String.raw`C:\Program Files\obs-studio\bin\64bit\obs64.exe`,
})
const ssms = app({
	id: 'ssms',
	name: 'SQL Server Management Studio 20',
	path: String.raw`C:\SSMS\Common7\IDE\Ssms.exe`,
})
const postgres = app({
	id: 'postgres',
	name: 'PostgreSQL 17',
	path: String.raw`C:\Program Files\PostgreSQL\17\bin\postgres.exe`,
	publisher: 'PostgreSQL Global Development Group',
})
const psql = app({
	id: 'psql',
	name: 'SQL Shell (psql)',
	path: String.raw`C:\Program Files\PostgreSQL\17\bin\psql.exe`,
	publisher: 'PostgreSQL Global Development Group',
})
const photoshop = app({
	id: 'photoshop',
	name: 'Adobe Photoshop 2024',
	path: String.raw`C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe`,
})
const battleNet = app({
	id: 'bnet',
	name: 'Battle.net',
	path: String.raw`C:\Program Files (x86)\Battle.net\Battle.net Launcher.exe`,
})
const wow = shortcut({
	id: 'wow',
	name: 'World of Warcraft',
	productName: 'World of Warcraft Launcher',
	originalFilename: 'World of Warcraft Launcher.exe',
	publisher: 'Blizzard Entertainment',
})
const pgadmin = shortcut({
	id: 'pgadmin',
	name: 'pgAdmin 4',
	originalFilename: 'pgAdmin4.exe',
	productName: 'pgAdmin 4',
	publisher: 'The pgAdmin Development Team',
})
const catalog = [
	wow,
	vscode,
	visualStudio,
	commandPrompt,
	gitCmd,
	terminal,
	docker,
	telegram,
	obs,
	ssms,
	postgres,
	psql,
	photoshop,
	battleNet,
	pgadmin,
]

describe('alias search', () => {
	it.each([
		['vscode', 'vscode'],
		['code', 'vscode'],
		['obs', 'obs'],
		['ssms', 'ssms'],
		['postgres', 'postgres'],
		['pgsql', 'postgres'],
		['psql', 'psql'],
		['tg', 'telegram'],
		['telegram', 'telegram'],
		['docker', 'docker'],
		['wt', 'wt'],
		['cmd', 'cmd'],
		['photoshop', 'photoshop'],
		['bnet', 'bnet'],
		['wow', 'wow'],
		['warcraft', 'wow'],
	])('ranks %s first as %s', (query, expected) => {
		expect(rankAppsByQuery(catalog, query)[0]?.id).toBe(expected)
	})

	it.each([
		['vs code', 'vscode'],
		['visual studio', 'vs'],
		['command prompt', 'cmd'],
		['sql shell', 'psql'],
		['battle net', 'bnet'],
		['git cmd', 'git-cmd'],
		['pg admin', 'pgadmin'],
	])('answers the multi-word query %s with %s first', (query, expected) => {
		expect(rankAppsByQuery(catalog, query)[0]?.id).toBe(expected)
	})

	it('prefers Visual Studio over VS Code for the bare vs', () => {
		expect(ids(rankAppsByQuery(catalog, 'vs')).slice(0, 2)).toEqual([
			'vs',
			'vscode',
		])
	})

	it('puts Command Prompt above Git CMD and leaves Windows Terminal out of cmd', () => {
		expect(ids(rankAppsByQuery(catalog, 'cmd'))).toEqual(['cmd', 'git-cmd'])
	})

	it('keeps psql on the shell rather than on the whole PostgreSQL family', () => {
		expect(ids(rankAppsByQuery(catalog, 'psql'))[0]).toBe('psql')
		expect(ids(rankAppsByQuery(catalog, 'psql'))).not.toContain('ssms')
		expect(ids(rankAppsByQuery(catalog, 'postgresql'))).toContain(
			'postgres',
		)
	})

	it('reaches every ranking surface', () => {
		expect(ids(filterAppsByQuery(catalog, 'vscode'))).toEqual(['vscode'])
		expect(ids(rankAppsByQueryTop(catalog, 'obs', 3))).toEqual(['obs'])
	})
})

describe('alias search through the query normalizer', () => {
	it.each([
		['сьв', ['cmd', 'git-cmd']],
		['мыcode', ['vscode']],
		['мысщву', ['vscode']],
		['вщслук', ['docker']],
		['це', ['wt']],
		['цщц', ['wow']],
	])('maps the wrong-layout query %s onto the alias', (query, expected) => {
		expect(ids(rankAppsByQuery(catalog, query))).toEqual(expected)
	})

	it.each([
		['телеграм', 'telegram'],
		['докер', 'docker'],
	])('transliterates %s onto the alias', (query, expected) => {
		expect(rankAppsByQuery(catalog, query)[0]?.id).toBe(expected)
	})

	it('ranks the literal layout above the corrected one when both exist', () => {
		const cyrillic = app({ id: 'cyrillic', name: 'сьв' })

		expect(ids(rankAppsByQuery([commandPrompt, cyrillic], 'сьв'))).toEqual([
			'cyrillic',
			'cmd',
		])
	})

	it('ranks a literal app name above the corrected strong alias of another app', () => {
		const named = app({ id: 'named', name: 'Мысщву' })

		expect(ids(rankAppsByQuery([vscode, named], 'мысщву'))).toEqual([
			'named',
			'vscode',
		])
	})
})

describe('alias ranking safety', () => {
	it('keeps the score ladder in the documented order', () => {
		const ladder = [
			SEARCH_SCORE.exactName,
			SEARCH_SCORE.namePrefixWithStrongAlias,
			SEARCH_SCORE.namePrefix,
			SEARCH_SCORE.strongAliasExact,
			SEARCH_SCORE.normalAliasExact,
			SEARCH_SCORE.strongAliasPrefix,
			SEARCH_SCORE.nameWordPrefix,
			SEARCH_SCORE.normalAliasPrefix,
			SEARCH_SCORE.weakAliasExact,
			SEARCH_SCORE.nameSubstring,
			SEARCH_SCORE.publisher,
			SEARCH_SCORE.secondary,
		]
		for (let index = 1; index < ladder.length; index += 1)
			expect(ladder[index - 1]).toBeGreaterThan(ladder[index]!)
		expect(
			SEARCH_SCORE.literalVariant + SEARCH_SCORE.secondary,
		).toBeGreaterThan(
			SEARCH_SCORE.correctedVariant + SEARCH_SCORE.exactName,
		)
	})

	it('ranks a literal name above a weak alias of another app', () => {
		const named = app({ id: 'ae-tool', name: 'AE Tool' })
		const afterEffects = app({
			id: 'ae',
			name: 'Adobe After Effects 2024',
			path: String.raw`C:\Adobe\AfterFX.exe`,
		})

		expect(ids(rankAppsByQuery([afterEffects, named], 'ae'))).toEqual([
			'ae-tool',
			'ae',
		])
	})

	it('ranks a strong alias above a secondary-metadata match', () => {
		const pathOnly = app({
			id: 'path-only',
			name: 'Helper',
			path: String.raw`C:\Tools\vscode-extras\helper.exe`,
		})

		expect(ids(rankAppsByQuery([pathOnly, vscode], 'vscode'))).toEqual([
			'vscode',
			'path-only',
		])
	})

	it('never fuzzy-matches a two-letter alias', () => {
		expect(rankAppsByQuery([telegram], 'th')).toEqual([])
		expect(rankAppsByQuery([terminal], 'wr')).toEqual([])
	})

	it('does not lend vscode to CodeBlocks and keeps its literal name ahead of the alias', () => {
		expect(
			ids(rankAppsByQuery([...catalog, codeBlocks], 'vscode')),
		).toEqual(['vscode'])
		expect(ids(rankAppsByQuery([codeBlocks, vscode], 'code'))).toEqual([
			'codeblocks',
			'vscode',
		])
	})

	it('keeps the existing typo tolerance on names and on strong aliases of five letters or more', () => {
		expect(ids(rankAppsByQuery([docker], 'doker'))).toEqual(['docker'])
		expect(ids(rankAppsByQuery([vscode], 'vscde'))).toEqual(['vscode'])
	})

	it('does not fuzzy-match a normal alias or a short strong alias', () => {
		expect(rankAppsByQuery([postgres], 'pgsqk')).toEqual([])
		expect(rankAppsByQuery([postgres], 'psql')).toEqual([])
		expect(rankAppsByQuery([commandPrompt], 'cmdx')).toEqual([])
	})

	it('matches a weak alias exactly and never by prefix', () => {
		const afterEffects = app({
			id: 'ae',
			name: 'Adobe After Effects 2024',
			path: String.raw`C:\Adobe\AfterFX.exe`,
		})
		expect(ids(rankAppsByQuery([afterEffects], 'ae'))).toEqual(['ae'])
		expect(ids(rankAppsByQuery([vscode], 'vsc'))).toEqual(['vscode'])
		expect(rankAppsByQuery([vscode], 'вско')).toEqual([])
		expect(rankAppsByQuery([photoshop], 'фш')).toEqual([photoshop])
	})
})

// An app that no dictionary and no package corpus knows still has to be findable by every safe
// form of its own metadata: the external corpus is an enhancement, never a requirement.
describe('unknown app fallback', () => {
	const acme = app({
		id: 'acme',
		name: 'Acme Super Editor 4.2',
		path: String.raw`C:\Acme\SuperEditor.exe`,
		publisher: 'Acme Corp',
	})

	it.each([
		'acme super editor',
		'supereditor',
		'supereditor.exe',
		'super',
		'acme',
		'editor',
		'фсьу',
	])('finds the unknown app by %s', query => {
		expect(ids(rankAppsByQuery([acme, vscode], query))[0]).toBe('acme')
	})

	it('does not lend it a host or helper name', () => {
		const hosted = app({
			id: 'hosted',
			name: 'Acme Notes',
			path: String.raw`C:\Acme\electron.exe`,
			publisher: 'Acme Corp',
		})
		expect(
			resolveSearchAliases(hosted).map(alias => alias.value),
		).not.toContain('electron')
	})
})

describe('multi-word alias phrases', () => {
	const twoAliases = app({
		id: 'two',
		name: 'Battle.net',
		path: String.raw`C:\Battle.net\Battle.net Launcher.exe`,
	})

	it('scores the whole query as one phrase when it equals or starts an alias', () => {
		expect(ids(rankAppsByQuery([vscode, visualStudio], 'vs code'))).toEqual(
			['vscode'],
		)
		expect(ids(rankAppsByQuery([vscode], 'vs co'))).toEqual(['vscode'])
		expect(ids(rankAppsByQuery([pgadmin], 'pg admin'))).toEqual(['pgadmin'])
		expect(ids(rankAppsByQuery([pgadmin], 'pg adm'))).toEqual(['pgadmin'])
	})

	it('reaches a phrase alias through the layout normalizer', () => {
		expect(ids(rankAppsByQuery([vscode], 'мы сщву'))).toEqual(['vscode'])
	})

	it('does not assemble a phrase from words of unrelated aliases or fields', () => {
		expect(rankAppsByQuery([twoAliases, vscode], 'vs net')).toEqual([])
		expect(rankAppsByQuery([twoAliases, vscode], 'battle code')).toEqual([])
	})

	it('still lets every token of a query match the name itself', () => {
		expect(ids(rankAppsByQuery([vscode], 'visual code'))).toEqual([
			'vscode',
		])
		expect(ids(rankAppsByQuery([battleNet], 'battle net'))).toEqual([
			'bnet',
		])
	})
})
