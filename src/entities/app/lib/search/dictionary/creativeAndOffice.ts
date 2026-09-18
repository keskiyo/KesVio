import type { KnownAppAliasEntry } from '../types'

const ADOBE = ['adobe'] as const
const MICROSOFT = ['microsoft'] as const
const LIBREOFFICE = ['document foundation', 'libreoffice'] as const

export const CREATIVE: readonly KnownAppAliasEntry[] = [
	{
		id: 'photoshop',
		match: {
			anyOf: [
				{ executable: ['photoshop.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['adobe photoshop'] },
						{ originalFilename: ['photoshop.exe'] },
					],
				},
				{
					allOf: [
						{ productNameStartsWith: ['adobe photoshop'] },
						{ publisherContains: ADOBE },
					],
				},
			],
			exclude: [
				{
					nameStartsWith: [
						'adobe photoshop elements',
						'adobe photoshop express',
						'adobe photoshop lightroom',
					],
				},
				{ productNameStartsWith: ['adobe photoshop lightroom'] },
			],
		},
		aliases: [
			['photoshop', 'strong'],
			['фотошоп', 'strong'],
			['фш', 'weak'],
		],
	},
	{
		id: 'illustrator',
		match: {
			anyOf: [
				{ executable: ['illustrator.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['adobe illustrator'] },
						{ originalFilename: ['illustrator.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['adobe illustrator'] },
						{ publisherContains: ADOBE },
					],
				},
			],
		},
		aliases: [
			['illustrator', 'strong'],
			['иллюстратор', 'normal'],
		],
	},
	{
		id: 'premiere-pro',
		match: {
			anyOf: [
				{ executable: ['adobe premiere pro.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['adobe premiere pro'] },
						{ originalFilename: ['adobe premiere pro.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['adobe premiere pro'] },
						{ publisherContains: ADOBE },
					],
				},
			],
		},
		aliases: [
			['premiere', 'strong'],
			['premiere pro', 'strong'],
			['премьер', 'normal'],
		],
	},
	{
		id: 'after-effects',
		match: {
			anyOf: [
				{ executable: ['afterfx.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['adobe after effects'] },
						{ originalFilename: ['afterfx.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['adobe after effects'] },
						{ publisherContains: ADOBE },
					],
				},
			],
		},
		aliases: [
			['after effects', 'strong'],
			['ae', 'weak'],
			['афтер эффектс', 'weak'],
		],
	},
	{
		id: 'acrobat',
		match: {
			anyOf: [
				{ executable: ['acrobat.exe', 'acrord32.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['adobe acrobat'] },
						{ originalFilename: ['acrobat.exe', 'acrord32.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['adobe acrobat'] },
						{ publisherContains: ADOBE },
					],
				},
				{ name: ['adobe acrobat', 'adobe acrobat reader'] },
			],
		},
		aliases: [
			['acrobat', 'strong'],
			['акробат', 'normal'],
		],
	},
	{
		id: 'lightroom',
		match: {
			anyOf: [
				{ executable: ['lightroom.exe'] },
				{
					allOf: [
						{
							nameStartsWith: [
								'adobe lightroom',
								'adobe photoshop lightroom',
							],
						},
						{ originalFilename: ['lightroom.exe'] },
					],
				},
				{
					allOf: [
						{
							nameStartsWith: [
								'adobe lightroom',
								'adobe photoshop lightroom',
							],
						},
						{ publisherContains: ADOBE },
					],
				},
			],
		},
		aliases: [
			['lightroom', 'strong'],
			['lr', 'weak'],
		],
	},
	{
		id: 'blender',
		match: {
			anyOf: [
				{ executable: ['blender.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['blender'] },
						{ originalFilename: ['blender.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['blender'] },
						{ publisherContains: ['blender'] },
					],
				},
				{ name: ['blender'] },
			],
		},
		aliases: [['blender', 'strong']],
	},
	{
		id: 'figma',
		match: { anyOf: [{ executable: ['figma.exe'] }, { name: ['figma'] }] },
		aliases: [['figma', 'strong']],
	},
	{
		id: 'gimp',
		match: {
			anyOf: [
				{ executable: ['gimp-2.10.exe', 'gimp-3.0.exe', 'gimp.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['gimp'] },
						{
							originalFilename: [
								'gimp-2.10.exe',
								'gimp-3.0.exe',
								'gimp.exe',
							],
						},
					],
				},
				{ name: ['gimp'] },
			],
		},
		aliases: [['gimp', 'strong']],
	},
	{
		id: 'krita',
		match: { anyOf: [{ executable: ['krita.exe'] }, { name: ['krita'] }] },
		aliases: [['krita', 'strong']],
	},
	{
		id: 'paint-net',
		match: {
			anyOf: [
				{ executable: ['paintdotnet.exe'] },
				{
					allOf: [
						{ name: ['paint.net'] },
						{ originalFilename: ['paintdotnet.exe'] },
					],
				},
				{ name: ['paint.net'] },
			],
		},
		aliases: [
			['paint.net', 'strong'],
			['paintnet', 'strong'],
			['pdn', 'weak'],
		],
	},
	{
		id: 'davinci-resolve',
		match: {
			anyOf: [
				{ executable: ['resolve.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['davinci resolve'] },
						{ originalFilename: ['resolve.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['davinci resolve'] },
						{ publisherContains: ['blackmagic'] },
					],
				},
				{ name: ['davinci resolve'] },
			],
		},
		aliases: [
			['davinci', 'strong'],
			['resolve', 'normal'],
			['давинчи', 'normal'],
		],
	},
]

export const OFFICE: readonly KnownAppAliasEntry[] = [
	{
		id: 'microsoft-word',
		match: {
			anyOf: [
				{ executable: ['winword.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['word', 'microsoft word'] },
						{ originalFilename: ['winword.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['word 20', 'microsoft word 20'] },
						{ publisherContains: MICROSOFT },
					],
				},
				{ name: ['word', 'microsoft word'] },
			],
			exclude: [{ nameStartsWith: ['wordpad'] }],
		},
		aliases: [
			['word', 'strong'],
			['winword', 'normal'],
			['ворд', 'strong'],
		],
	},
	{
		id: 'microsoft-excel',
		match: {
			anyOf: [
				{ executable: ['excel.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['excel', 'microsoft excel'] },
						{ originalFilename: ['excel.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['excel 20', 'microsoft excel 20'] },
						{ publisherContains: MICROSOFT },
					],
				},
				{ name: ['excel', 'microsoft excel'] },
			],
		},
		aliases: [
			['excel', 'strong'],
			['эксель', 'strong'],
		],
	},
	{
		id: 'microsoft-powerpoint',
		match: {
			anyOf: [
				{ executable: ['powerpnt.exe'] },
				{
					allOf: [
						{
							nameStartsWith: [
								'powerpoint',
								'microsoft powerpoint',
							],
						},
						{ originalFilename: ['powerpnt.exe'] },
					],
				},
				{
					allOf: [
						{
							nameStartsWith: [
								'powerpoint 20',
								'microsoft powerpoint 20',
							],
						},
						{ publisherContains: MICROSOFT },
					],
				},
				{ name: ['powerpoint', 'microsoft powerpoint'] },
			],
		},
		aliases: [
			['powerpoint', 'strong'],
			['power point', 'normal'],
		],
	},
	{
		id: 'onenote',
		match: {
			anyOf: [
				{ executable: ['onenote.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['onenote', 'microsoft onenote'] },
						{ originalFilename: ['onenote.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['onenote', 'microsoft onenote'] },
						{ publisherContains: MICROSOFT },
					],
				},
				{ name: ['onenote', 'microsoft onenote'] },
			],
		},
		aliases: [
			['onenote', 'strong'],
			['one note', 'normal'],
		],
	},
	{
		id: 'libreoffice',
		match: {
			anyOf: [
				{ executable: ['soffice.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['libreoffice'] },
						{ originalFilename: ['soffice.exe'] },
					],
				},
				{
					allOf: [
						{ name: ['libreoffice'] },
						{ publisherContains: LIBREOFFICE },
					],
				},
				{ name: ['libreoffice'] },
			],
			exclude: [
				{
					nameStartsWith: [
						'libreoffice writer',
						'libreoffice calc',
						'libreoffice impress',
						'libreoffice draw',
						'libreoffice base',
						'libreoffice math',
						'libreoffice help',
					],
				},
			],
		},
		aliases: [
			['libreoffice', 'strong'],
			['libre', 'normal'],
		],
	},
	{
		id: 'libreoffice-writer',
		match: {
			anyOf: [
				{ executable: ['swriter.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['libreoffice writer'] },
						{ publisherContains: LIBREOFFICE },
					],
				},
				{ name: ['libreoffice writer'] },
			],
		},
		aliases: [['libreoffice writer', 'strong']],
	},
	{
		id: 'libreoffice-calc',
		match: {
			anyOf: [
				{ executable: ['scalc.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['libreoffice calc'] },
						{ publisherContains: LIBREOFFICE },
					],
				},
				{ name: ['libreoffice calc'] },
			],
		},
		aliases: [['libreoffice calc', 'strong']],
	},
	{
		id: 'libreoffice-impress',
		match: {
			anyOf: [
				{ executable: ['simpress.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['libreoffice impress'] },
						{ publisherContains: LIBREOFFICE },
					],
				},
				{ name: ['libreoffice impress'] },
			],
		},
		aliases: [['libreoffice impress', 'strong']],
	},
	{
		id: 'libreoffice-draw',
		match: {
			anyOf: [
				{ executable: ['sdraw.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['libreoffice draw'] },
						{ publisherContains: LIBREOFFICE },
					],
				},
				{ name: ['libreoffice draw'] },
			],
		},
		aliases: [['libreoffice draw', 'strong']],
	},
	{
		id: 'libreoffice-base',
		match: {
			anyOf: [
				{ executable: ['sbase.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['libreoffice base'] },
						{ publisherContains: LIBREOFFICE },
					],
				},
				{ name: ['libreoffice base'] },
			],
		},
		aliases: [['libreoffice base', 'strong']],
	},
	{
		id: 'libreoffice-math',
		match: {
			anyOf: [
				{ executable: ['smath.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['libreoffice math'] },
						{ publisherContains: LIBREOFFICE },
					],
				},
				{ name: ['libreoffice math'] },
			],
		},
		aliases: [['libreoffice math', 'strong']],
	},
	{
		id: 'obsidian',
		match: {
			anyOf: [
				{ executable: ['obsidian.exe'] },
				{
					allOf: [
						{ name: ['obsidian'] },
						{ publisherContains: ['dynalist', 'obsidian'] },
					],
				},
				{ name: ['obsidian'] },
			],
		},
		aliases: [['obsidian', 'strong']],
	},
	{
		id: 'notion',
		match: {
			anyOf: [
				{ executable: ['notion.exe'] },
				{
					allOf: [
						{ name: ['notion'] },
						{ publisherContains: ['notion'] },
					],
				},
				{ name: ['notion'] },
			],
		},
		aliases: [
			['notion', 'strong'],
			['ноушен', 'weak'],
		],
	},
]
