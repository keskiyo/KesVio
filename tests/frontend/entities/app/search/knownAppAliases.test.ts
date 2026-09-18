import { describe, expect, it } from 'vitest'
import {
	grantedConfidence,
	matchedKnownEntries,
	resolveSearchAliases,
} from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import type { AppInfo } from '../../../../../src/entities/app'
import { app, msix, shortcut } from './fixtures/app'

const aliasesOf = (info: AppInfo) =>
	new Map(
		resolveSearchAliases(info).map(alias => [
			alias.value,
			alias.confidence,
		]),
	)

const matchIds = (info: AppInfo) =>
	matchedKnownEntries(info).map(
		match => `${match.entry.id}:${match.strength}`,
	)

describe('resolveSearchAliases', () => {
	it.each([
		[
			'Command Prompt shortcut with the cmd.exe target metadata',
			shortcut({
				id: 'cmd',
				name: 'Command Prompt',
				originalFilename: 'Cmd.Exe.MUI',
			}),
			['command-prompt:strong'],
			{ cmd: 'strong', 'cmd.exe': 'normal' },
		],
		[
			'Command Prompt shortcut before hydration',
			shortcut({
				id: 'cmd',
				name: 'Command Prompt',
				originalFilename: null,
			}),
			['command-prompt:normal'],
			{ cmd: 'normal' },
		],
		[
			'Visual Studio Code by its executable',
			app({
				id: 'code',
				name: 'Visual Studio Code',
				path: String.raw`C:\VS Code\Code.exe`,
				productName: 'Visual Studio Code',
			}),
			['visual-studio-code:strong'],
			{
				vscode: 'strong',
				'vs code': 'strong',
				code: 'normal',
				vsc: 'weak',
			},
		],
		[
			'Visual Studio Code shortcut hosted by electron.exe',
			shortcut({
				id: 'code',
				name: 'Visual Studio Code',
				originalFilename: 'electron.exe',
				productName: 'Visual Studio Code',
				publisher: 'Microsoft Corporation',
			}),
			['visual-studio-code:strong'],
			{ vscode: 'strong' },
		],
		[
			'IntelliJ IDEA shortcut',
			shortcut({
				id: 'idea',
				name: 'IntelliJ IDEA Community Edition 2024.2',
				originalFilename: 'idea64.exe',
				publisher: 'JetBrains s.r.o.',
			}),
			['intellij-idea:normal'],
			{ intellij: 'normal', idea: 'normal' },
		],
		[
			'OBS Studio by its executable',
			app({
				id: 'obs',
				name: 'OBS Studio',
				path: String.raw`C:\OBS\bin\64bit\obs64.exe`,
			}),
			['obs-studio:strong'],
			{ obs: 'strong' },
		],
		[
			'PostgreSQL server by its executable',
			app({
				id: 'pg',
				name: 'PostgreSQL 15',
				path: String.raw`C:\Program Files\PostgreSQL\15\bin\postgres.exe`,
				publisher: 'PostgreSQL Global Development Group',
			}),
			['postgresql:strong'],
			{ postgres: 'strong', pgsql: 'normal' },
		],
		[
			'PostgreSQL family record by name prefix and publisher',
			app({
				id: 'pg',
				name: 'PostgreSQL 17',
				publisher: 'PostgreSQL Global Development Group',
			}),
			['postgresql:normal'],
			{ postgres: 'normal', postgresql: 'normal' },
		],
		[
			'Windows Terminal package',
			msix({
				id: 'wt',
				name: 'Terminal',
				family: 'Microsoft.WindowsTerminal_8wekyb3d8bbwe',
				productName: 'Microsoft.WindowsTerminal',
			}),
			['windows-terminal:strong'],
			{ wt: 'strong', 'windows terminal': 'strong' },
		],
		[
			'Steam shortcut',
			shortcut({
				id: 'steam',
				name: 'Steam',
				originalFilename: 'steam.exe',
				productName: 'Steam',
				publisher: 'Valve Corporation',
			}),
			['steam:strong'],
			{ стим: 'strong' },
		],
		[
			'Counter-Strike 2 by its Steam app id',
			app({
				id: 'cs2',
				name: 'Counter-Strike 2',
				path: 'steam://rungameid/730',
				sourceKind: 'steam',
			}),
			['counter-strike:strong'],
			{ cs2: 'strong', csgo: 'strong' },
		],
	] as const)('%s', (_label, info, expectedMatches, expectedAliases) => {
		expect(matchIds(info)).toEqual(expectedMatches)
		const aliases = aliasesOf(info)
		for (const [value, confidence] of Object.entries(expectedAliases))
			expect(aliases.get(value), value).toBe(confidence)
	})

	it('caps a strong alias at normal when only a normal identity matched', () => {
		expect(grantedConfidence('strong', 'normal')).toBe('normal')
		expect(grantedConfidence('normal', 'normal')).toBe('normal')
		expect(grantedConfidence('weak', 'normal')).toBe('weak')
		expect(grantedConfidence('strong', 'strong')).toBe('strong')
	})

	it('keeps a curated confidence above a generated one for the same value', () => {
		const vscode = app({
			id: 'code',
			name: 'Visual Studio Code',
			path: String.raw`C:\VS Code\Code.exe`,
		})
		expect(aliasesOf(vscode).get('code')).toBe('normal')
		expect(aliasesOf(vscode).get('vscode')).toBe('strong')
		expect(
			resolveSearchAliases(vscode).filter(
				alias => alias.value === 'code',
			),
		).toHaveLength(1)
	})

	it('returns aliases sorted strongest first', () => {
		const confidences = resolveSearchAliases(
			app({
				id: 'code',
				name: 'Visual Studio Code',
				path: String.raw`C:\VS Code\Code.exe`,
			}),
		).map(alias => alias.confidence)
		const rank = { strong: 3, normal: 2, weak: 1 }
		for (let index = 1; index < confidences.length; index += 1)
			expect(rank[confidences[index - 1]!]).toBeGreaterThanOrEqual(
				rank[confidences[index]!],
			)
	})
})
