import { describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { resolveSearchAliases } from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import type { AppInfo } from '../../../../../src/entities/app'
import { CATALOGS } from './fixtures/catalogs'

interface SiblingGroup {
	family: string
	catalog: keyof typeof CATALOGS
	owner: string
	siblings: string[]
	aliases: string[]
	strongQuery: string
}

const GROUPS: SiblingGroup[] = [
	{
		family: 'Visual Studio / Visual Studio Code',
		catalog: 'developer',
		owner: 'visual-studio',
		siblings: [
			'vscode',
			'vscode-insiders',
			'visual-studio-installer',
			'vs-installer-helper',
		],
		aliases: ['visual studio', 'devenv', 'vs'],
		strongQuery: 'devenv',
	},
	{
		family: 'Visual Studio Code / Visual Studio',
		catalog: 'developer',
		owner: 'vscode',
		siblings: ['visual-studio', 'vscode-insiders', 'codeblocks'],
		aliases: ['vscode', 'vs code'],
		strongQuery: 'vscode',
	},
	{
		family: 'Microsoft Edge / WebView2 / Update',
		catalog: 'helper-heavy',
		owner: 'edge',
		siblings: ['edge-webview2', 'edge-update'],
		aliases: ['edge', 'msedge'],
		strongQuery: 'edge',
	},
	{
		family: 'Chrome / Chrome-hosted PWA / ChatGPT',
		catalog: 'helper-heavy',
		owner: 'chrome',
		siblings: ['chatgpt', 'chatgpt-pwa', 'youtube-pwa', 'chrome-proxy'],
		aliases: ['chrome', 'google chrome'],
		strongQuery: 'chrome',
	},
	{
		family: 'Windows Terminal / OpenConsole',
		catalog: 'developer',
		owner: 'windows-terminal',
		siblings: ['open-console', 'command-prompt', 'windows-powershell'],
		aliases: ['wt', 'windows terminal'],
		strongQuery: 'wt',
	},
	{
		family: 'Command Prompt / Git CMD / Developer Command Prompt',
		catalog: 'developer',
		owner: 'command-prompt',
		siblings: [
			'git-cmd',
			'developer-command-prompt',
			'windows-terminal',
			'open-console',
		],
		aliases: ['cmd', 'command prompt'],
		strongQuery: 'cmd',
	},
	{
		family: 'PowerShell ISE / Windows PowerShell',
		catalog: 'developer',
		owner: 'powershell-ise',
		siblings: ['windows-powershell', 'pwsh'],
		aliases: ['powershell ise', 'ise'],
		strongQuery: 'powershell ise',
	},
	{
		family: 'Windows PowerShell / ISE',
		catalog: 'windows-en',
		owner: 'windows-powershell',
		siblings: ['powershell-ise'],
		aliases: ['powershell'],
		strongQuery: 'windows powershell',
	},
	{
		family: 'Steam / bootstrapper / helpers',
		catalog: 'gaming',
		owner: 'steam',
		siblings: [
			'steam-bootstrapper',
			'steam-webhelper',
			'steam-service',
			'steamworks-redist',
			'steam-support',
			'source-sdk',
		],
		aliases: ['steam', 'стим'],
		strongQuery: 'стим',
	},
	{
		family: 'Battle.net / helper / agent / setup',
		catalog: 'gaming',
		owner: 'battle-net',
		siblings: [
			'battle-net-agent',
			'battle-net-helper',
			'battle-net-setup',
			'wow',
		],
		aliases: ['battle net', 'battlenet', 'bnet'],
		strongQuery: 'battlenet',
	},
	{
		family: 'PostgreSQL / Stack Builder / psql / pgAdmin',
		catalog: 'developer',
		owner: 'postgres',
		siblings: ['stack-builder', 'psql', 'pgadmin', 'pg-dump'],
		aliases: ['postgres', 'pgsql'],
		strongQuery: 'postgres',
	},
	{
		family: 'psql / PostgreSQL',
		catalog: 'developer',
		owner: 'psql',
		siblings: ['postgres', 'stack-builder', 'pgadmin'],
		aliases: ['psql', 'sql shell'],
		strongQuery: 'psql',
	},
	{
		family: 'MySQL Server / Workbench / Shell',
		catalog: 'developer',
		owner: 'mysql-server',
		siblings: ['mysql-shell'],
		aliases: ['mysql'],
		strongQuery: 'mysql',
	},
	{
		family: 'MySQL Workbench / Server',
		catalog: 'developer',
		owner: 'mysql-workbench',
		siblings: ['mysql-server', 'mysql-shell'],
		aliases: ['mysql workbench'],
		strongQuery: 'mysql workbench',
	},
	{
		family: 'Photoshop / Creative Cloud helpers / Elements / Lightroom',
		catalog: 'creative',
		owner: 'photoshop',
		siblings: [
			'creative-cloud',
			'cc-helper',
			'adobe-updater',
			'photoshop-elements',
			'lightroom',
		],
		aliases: ['photoshop', 'фотошоп'],
		strongQuery: 'фотошоп',
	},
	{
		family: 'Java runtime / updater',
		catalog: 'helper-heavy',
		owner: 'java',
		siblings: ['java-updater'],
		aliases: ['java'],
		strongQuery: 'java',
	},
	{
		family: 'Discord / Squirrel updater',
		catalog: 'helper-heavy',
		owner: 'discord',
		siblings: ['squirrel-update'],
		aliases: ['discord', 'дискорд'],
		strongQuery: 'дискорд',
	},
	{
		family: 'Telegram / updater',
		catalog: 'helper-heavy',
		owner: 'telegram',
		siblings: ['telegram-updater'],
		aliases: ['telegram', 'tg'],
		strongQuery: 'telegram',
	},
	{
		family: 'NVIDIA App / Share / FrameView / Control Panel',
		catalog: 'gaming',
		owner: 'nvidia-app',
		siblings: ['nvidia-share'],
		aliases: ['nvidia', 'geforce'],
		strongQuery: 'nvidia',
	},
	{
		family: 'Windows Control Panel / NVIDIA Control Panel',
		catalog: 'windows-en',
		owner: 'control-panel',
		siblings: ['nvidia-control-panel'],
		aliases: ['control panel'],
		strongQuery: 'control panel',
	},
	{
		family: 'Notepad / Notepad++',
		catalog: 'windows-en',
		owner: 'notepad',
		siblings: ['notepad-plus-plus'],
		aliases: ['notepad', 'блокнот'],
		strongQuery: 'блокнот',
	},
	{
		family: 'Paint / paint.net',
		catalog: 'windows-en',
		owner: 'paint',
		siblings: ['paint-net'],
		aliases: ['mspaint', 'paint'],
		strongQuery: 'mspaint',
	},
	{
		family: 'Word / WordPad',
		catalog: 'creative',
		owner: 'word',
		siblings: ['wordpad'],
		aliases: ['word', 'ворд', 'winword'],
		strongQuery: 'ворд',
	},
]

function record(catalog: keyof typeof CATALOGS, id: string): AppInfo {
	const found = CATALOGS[catalog].find(entry => entry.id === id)
	if (!found) throw new Error(`${catalog} has no record ${id}`)
	return found
}

const aliasValues = (info: AppInfo) =>
	resolveSearchAliases(info).map(alias => alias.value)

describe.each(GROUPS.map(group => [group.family, group]))(
	'%s',
	(_family, group) => {
		it('gives the owner every alias of the family', () => {
			const owner = record(group.catalog, group.owner)
			const owned = [
				...aliasValues(owner),
				owner.name.toLocaleLowerCase(),
			]
			for (const alias of group.aliases) expect(owned).toContain(alias)
		})

		it.each(group.siblings)(
			'does not give %s any alias of the family',
			id => {
				const owned = aliasValues(record(group.catalog, id))
				for (const alias of group.aliases)
					expect(owned).not.toContain(alias)
			},
		)

		it(`ranks the owner first for ${group.strongQuery}`, () => {
			const ranked = rankAppsByQuery(
				CATALOGS[group.catalog],
				group.strongQuery,
			)
			expect(ranked[0]?.id).toBe(group.owner)
		})
	},
)
