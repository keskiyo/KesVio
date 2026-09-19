import type { KnownAppAliasEntry } from '../types'

const MICROSOFT = ['microsoft'] as const
const JETBRAINS = ['jetbrains'] as const

export const DEVELOPMENT: readonly KnownAppAliasEntry[] = [
	{
		id: 'visual-studio-code',
		match: {
			anyOf: [
				{ executable: ['code.exe'] },
				{
					allOf: [
						{ productName: ['visual studio code'] },
						{ publisherContains: MICROSOFT },
					],
				},
				{ name: ['visual studio code'] },
				{ productName: ['visual studio code'] },
			],
			exclude: [
				{
					nameStartsWith: [
						'visual studio code -',
						'visual studio code insiders',
					],
				},
			],
		},
		aliases: [
			['vscode', 'strong'],
			['vs code', 'strong'],
			['code', 'normal'],
			['vsc', 'weak'],
			['вскод', 'weak'],
		],
	},
	{
		id: 'vscodium',
		match: {
			anyOf: [
				{ executable: ['vscodium.exe'] },
				{ name: ['vscodium'] },
				{ productName: ['vscodium'] },
			],
		},
		aliases: [
			['codium', 'strong'],
			['vscodium', 'strong'],
		],
	},
	{
		id: 'visual-studio',
		match: {
			anyOf: [
				{ executable: ['devenv.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['visual studio 20'] },
						{ originalFilename: ['devenv.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['visual studio 20'] },
						{ publisherContains: MICROSOFT },
					],
				},
			],
			exclude: [
				{ executable: ['code.exe', 'vs_installer.exe', 'setup.exe'] },
				{ productName: ['visual studio code'] },
				{ originalFilename: ['setup.exe', 'vs_installer.exe'] },
				{
					nameStartsWith: [
						'visual studio code',
						'visual studio installer',
					],
				},
			],
		},
		aliases: [
			['visual studio', 'strong'],
			['vs', 'normal'],
			['devenv', 'strong'],
		],
	},
	{
		id: 'intellij-idea',
		match: {
			anyOf: [
				{ executable: ['idea64.exe', 'idea.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['intellij idea'] },
						{ originalFilename: ['idea64.exe', 'idea.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['intellij idea'] },
						{ publisherContains: JETBRAINS },
					],
				},
				{ productName: ['intellij idea'] },
			],
		},
		aliases: [
			['intellij', 'strong'],
			['idea', 'strong'],
		],
	},
	{
		id: 'pycharm',
		match: {
			anyOf: [
				{ executable: ['pycharm64.exe', 'pycharm.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['pycharm'] },
						{ originalFilename: ['pycharm64.exe', 'pycharm.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['pycharm'] },
						{ publisherContains: JETBRAINS },
					],
				},
			],
		},
		aliases: [['pycharm', 'strong']],
	},
	{
		id: 'webstorm',
		match: {
			anyOf: [
				{ executable: ['webstorm64.exe', 'webstorm.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['webstorm'] },
						{
							originalFilename: [
								'webstorm64.exe',
								'webstorm.exe',
							],
						},
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['webstorm'] },
						{ publisherContains: JETBRAINS },
					],
				},
			],
		},
		aliases: [['webstorm', 'strong']],
	},
	{
		id: 'rider',
		match: {
			anyOf: [
				{ executable: ['rider64.exe', 'rider.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['jetbrains rider', 'rider'] },
						{ originalFilename: ['rider64.exe', 'rider.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['jetbrains rider'] },
						{ publisherContains: JETBRAINS },
					],
				},
			],
		},
		aliases: [['rider', 'strong']],
	},
	{
		id: 'android-studio',
		match: {
			anyOf: [
				{ executable: ['studio64.exe'] },
				{
					allOf: [
						{ name: ['android studio'] },
						{ originalFilename: ['studio64.exe'] },
					],
				},
				{ name: ['android studio'] },
				{ productName: ['android studio'] },
			],
		},
		aliases: [['android studio', 'strong']],
	},
	{
		id: 'git-bash',
		match: {
			anyOf: [
				{ executable: ['git-bash.exe'] },
				{
					allOf: [
						{ name: ['git bash'] },
						{ originalFilename: ['git-bash.exe', 'git.exe'] },
					],
				},
				{ name: ['git bash'] },
			],
		},
		aliases: [
			['git bash', 'strong'],
			['bash', 'normal'],
		],
	},
	{
		id: 'git-gui',
		match: { anyOf: [{ name: ['git gui'] }] },
		aliases: [['git gui', 'normal']],
	},
	{
		id: 'docker-desktop',
		match: {
			anyOf: [
				{ executable: ['docker desktop.exe'] },
				{
					allOf: [
						{ productName: ['docker desktop'] },
						{ publisherContains: ['docker'] },
					],
				},
				{ name: ['docker desktop'] },
				{ productName: ['docker desktop'] },
			],
		},
		aliases: [
			['docker', 'strong'],
			['docker desktop', 'strong'],
		],
	},
	{
		id: 'nodejs',
		match: {
			anyOf: [
				{
					allOf: [
						{ executable: ['node.exe'] },
						{ nameStartsWith: ['node.js'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['node.js'] },
						{ originalFilename: ['node.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['node.js'] },
						{ publisherContains: ['node.js foundation', 'openjs'] },
					],
				},
				{ name: ['node.js'] },
			],
		},
		aliases: [
			['node', 'strong'],
			['nodejs', 'strong'],
			['node.js', 'strong'],
		],
	},
	{
		id: 'python',
		match: {
			anyOf: [
				{
					allOf: [
						{ executable: ['python.exe', 'pythonw.exe'] },
						{ nameStartsWith: ['python 3', 'python 2'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['python 3', 'python 2'] },
						{
							originalFilename: [
								'python.exe',
								'pythonw.exe',
								'py.exe',
							],
						},
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['python 3', 'python 2'] },
						{ publisherContains: ['python software foundation'] },
					],
				},
			],
		},
		aliases: [['python', 'strong']],
	},
	{
		id: 'java',
		match: {
			anyOf: [
				{
					allOf: [
						{ executable: ['java.exe', 'javaw.exe'] },
						{
							nameStartsWith: [
								'java(tm)',
								'java se',
								'openjdk',
								'java 8',
								'java 1',
							],
						},
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['java(tm)', 'java se', 'openjdk'] },
						{
							publisherContains: [
								'oracle',
								'eclipse',
								'microsoft',
							],
						},
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['java'] },
						{ productNameStartsWith: ['java(tm)'] },
						{ publisherContains: ['oracle'] },
					],
				},
			],
		},
		aliases: [
			['java', 'strong'],
			['jre', 'normal'],
		],
	},
	{
		id: 'jdk',
		match: {
			anyOf: [
				{
					allOf: [
						{
							nameStartsWith: [
								'java(tm) se development kit',
								'java se development kit',
								'openjdk',
								'microsoft build of openjdk',
								'eclipse temurin jdk',
							],
						},
						{
							publisherContains: [
								'oracle',
								'eclipse',
								'microsoft',
								'adoptium',
							],
						},
					],
				},
			],
		},
		aliases: [['jdk', 'normal']],
	},
	{
		id: 'deno',
		match: { anyOf: [{ executable: ['deno.exe'] }, { name: ['deno'] }] },
		aliases: [['deno', 'strong']],
	},
	{
		id: 'bun',
		match: { anyOf: [{ executable: ['bun.exe'] }, { name: ['bun'] }] },
		aliases: [['bun', 'strong']],
	},
	{
		id: 'ollama',
		match: {
			anyOf: [
				{ executable: ['ollama.exe', 'ollama app.exe'] },
				{ name: ['ollama'] },
			],
		},
		aliases: [['ollama', 'strong']],
	},
	{
		id: 'claude',
		match: {
			anyOf: [
				{ executable: ['claude.exe'] },
				{
					allOf: [
						{ name: ['claude'] },
						{ publisherContains: ['anthropic'] },
					],
				},
				{ name: ['claude'] },
			],
		},
		aliases: [
			['claude', 'strong'],
			['клод', 'normal'],
		],
	},
	{
		id: 'chatgpt',
		match: {
			anyOf: [
				{
					packageFamily: [
						'openai.chatgpt-desktop_2p2nqsd0c76g0',
						'openai.codex_2p2nqsd0c76g0',
					],
				},
				{
					allOf: [
						{ productName: ['openai.chatgpt', 'openai.codex'] },
						{ publisherContains: ['openai'] },
					],
				},
				{
					allOf: [
						{ name: ['chatgpt'] },
						{ publisherContains: ['openai'] },
					],
				},
				{ name: ['chatgpt'] },
			],
		},
		aliases: [
			['chatgpt', 'strong'],
			['gpt', 'strong'],
			['чат гпт', 'normal'],
		],
	},
	{
		id: 'opencode',
		match: {
			anyOf: [{ name: ['opencode'] }, { productName: ['opencode'] }],
		},
		aliases: [['opencode', 'normal']],
	},
	{
		id: 'filezilla',
		match: {
			anyOf: [{ executable: ['filezilla.exe'] }, { name: ['filezilla'] }],
		},
		aliases: [['filezilla', 'strong']],
	},
	{
		id: 'postman',
		match: {
			anyOf: [{ executable: ['postman.exe'] }, { name: ['postman'] }],
		},
		aliases: [['postman', 'strong']],
	},
	{
		id: 'github-desktop',
		match: {
			anyOf: [
				{ executable: ['githubdesktop.exe'] },
				{
					allOf: [
						{ name: ['github desktop'] },
						{ originalFilename: ['githubdesktop.exe'] },
					],
				},
				{ name: ['github desktop'] },
			],
		},
		aliases: [
			['github', 'strong'],
			['github desktop', 'strong'],
		],
	},
	{
		id: 'sublime-text',
		match: {
			anyOf: [
				{ executable: ['sublime_text.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['sublime text'] },
						{ originalFilename: ['sublime_text.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['sublime text'] },
						{ publisherContains: ['sublime hq'] },
					],
				},
				{ name: ['sublime text'] },
			],
		},
		aliases: [
			['sublime', 'strong'],
			['subl', 'normal'],
		],
	},
	{
		id: 'putty',
		match: { anyOf: [{ executable: ['putty.exe'] }, { name: ['putty'] }] },
		aliases: [['putty', 'strong']],
	},
	{
		id: 'winscp',
		match: {
			anyOf: [{ executable: ['winscp.exe'] }, { name: ['winscp'] }],
		},
		aliases: [['winscp', 'strong']],
	},
	{
		id: 'unity-hub',
		match: {
			anyOf: [{ executable: ['unity hub.exe'] }, { name: ['unity hub'] }],
		},
		aliases: [
			['unity', 'strong'],
			['unity hub', 'strong'],
		],
	},
]
