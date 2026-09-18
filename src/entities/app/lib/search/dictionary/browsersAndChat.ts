import type { KnownAppAliasEntry } from '../types'

export const BROWSERS: readonly KnownAppAliasEntry[] = [
	{
		id: 'google-chrome',
		match: {
			anyOf: [
				{ executable: ['chrome.exe'] },
				{
					allOf: [
						{ name: ['google chrome'] },
						{ originalFilename: ['chrome.exe'] },
					],
				},
				{
					allOf: [
						{ name: ['google chrome'] },
						{ publisherContains: ['google'] },
					],
				},
				{ name: ['google chrome'] },
			],
			exclude: [
				{ executable: ['chrome_proxy.exe'] },
				{ originalFilename: ['chrome_proxy.exe'] },
				{
					nameStartsWith: [
						'google chrome canary',
						'google chrome beta',
					],
				},
			],
		},
		aliases: [
			['chrome', 'strong'],
			['google chrome', 'strong'],
			['гугл хром', 'normal'],
		],
	},
	{
		id: 'firefox',
		match: {
			anyOf: [
				{ executable: ['firefox.exe'] },
				{
					allOf: [
						{ name: ['mozilla firefox', 'firefox'] },
						{ originalFilename: ['firefox.exe'] },
					],
				},
				{
					allOf: [
						{ name: ['mozilla firefox', 'firefox'] },
						{ publisherContains: ['mozilla'] },
					],
				},
				{ name: ['mozilla firefox', 'firefox'] },
			],
		},
		aliases: [
			['firefox', 'strong'],
			['мозила', 'weak'],
			['лиса', 'weak'],
		],
	},
	{
		id: 'microsoft-edge',
		match: {
			anyOf: [
				{ executable: ['msedge.exe'] },
				{
					allOf: [
						{ name: ['microsoft edge'] },
						{ originalFilename: ['msedge.exe'] },
					],
				},
				{
					allOf: [
						{ name: ['microsoft edge'] },
						{ publisherContains: ['microsoft'] },
					],
				},
				{ name: ['microsoft edge'] },
			],
			exclude: [
				{
					executable: [
						'msedgewebview2.exe',
						'microsoftedgeupdate.exe',
						'msedge_proxy.exe',
					],
				},
				{
					originalFilename: [
						'msedgewebview2.exe',
						'microsoftedgeupdate.exe',
						'microsoftedgeupdatesetup.exe',
						'msedge_proxy.exe',
					],
				},
				{
					productNameStartsWith: [
						'microsoft edge webview2',
						'microsoft edge update',
					],
				},
				{
					nameStartsWith: [
						'microsoft edge webview2',
						'microsoft edge update',
						'microsoft edge beta',
						'microsoft edge dev',
						'microsoft edge canary',
					],
				},
			],
		},
		aliases: [
			['edge', 'strong'],
			['msedge', 'normal'],
			['эдж', 'normal'],
		],
	},
	{
		id: 'brave',
		match: {
			anyOf: [
				{ executable: ['brave.exe'] },
				{
					allOf: [
						{ name: ['brave', 'brave browser'] },
						{ publisherContains: ['brave'] },
					],
				},
				{ name: ['brave', 'brave browser'] },
			],
		},
		aliases: [['brave', 'strong']],
	},
	{
		id: 'opera',
		match: {
			anyOf: [
				{ executable: ['opera.exe'] },
				{
					allOf: [
						{ name: ['opera', 'opera browser', 'opera gx'] },
						{ publisherContains: ['opera'] },
					],
				},
				{ name: ['opera', 'opera browser', 'opera gx'] },
			],
		},
		aliases: [['opera', 'strong']],
	},
	{
		id: 'yandex-browser',
		match: {
			anyOf: [
				{ executable: ['browser.exe'] },
				{
					allOf: [
						{
							name: [
								'yandex browser',
								'яндекс браузер',
								'yandex',
							],
						},
						{ publisherContains: ['yandex', 'яндекс'] },
					],
				},
				{ name: ['yandex browser', 'яндекс браузер', 'yandex'] },
			],
		},
		aliases: [
			['yandex', 'strong'],
			['yandex browser', 'strong'],
			['яндекс', 'strong'],
			['яндекс браузер', 'strong'],
		],
	},
	{
		id: 'vivaldi',
		match: {
			anyOf: [{ executable: ['vivaldi.exe'] }, { name: ['vivaldi'] }],
		},
		aliases: [['vivaldi', 'strong']],
	},
	{
		id: 'tor-browser',
		match: {
			anyOf: [
				{
					allOf: [
						{ productName: ['tor browser'] },
						{ publisherContains: ['tor project'] },
					],
				},
				{ name: ['tor browser'] },
				{ productName: ['tor browser'] },
			],
		},
		aliases: [['tor', 'strong']],
	},
]

export const COMMUNICATION: readonly KnownAppAliasEntry[] = [
	{
		id: 'telegram',
		match: {
			anyOf: [
				{ executable: ['telegram.exe'] },
				{
					allOf: [
						{ productName: ['telegram desktop'] },
						{ publisherContains: ['telegram'] },
					],
				},
				{
					allOf: [
						{ name: ['telegram desktop', 'telegram'] },
						{ originalFilename: ['telegram.exe'] },
					],
				},
				{ name: ['telegram desktop', 'telegram'] },
			],
		},
		aliases: [
			['telegram', 'strong'],
			['tg', 'normal'],
			['телега', 'normal'],
		],
	},
	{
		id: 'discord',
		match: {
			anyOf: [
				{ executable: ['discord.exe'] },
				{
					allOf: [
						{ productName: ['discord'] },
						{ publisherContains: ['discord'] },
					],
				},
				{ name: ['discord'] },
			],
		},
		aliases: [
			['discord', 'strong'],
			['дискорд', 'normal'],
			['дс', 'weak'],
		],
	},
	{
		id: 'slack',
		match: {
			anyOf: [
				{ executable: ['slack.exe'] },
				{
					allOf: [
						{ productName: ['slack'] },
						{ publisherContains: ['slack'] },
					],
				},
				{ name: ['slack'] },
			],
		},
		aliases: [['slack', 'strong']],
	},
	{
		id: 'microsoft-teams',
		match: {
			anyOf: [
				{ packageFamily: ['msteams_8wekyb3d8bbwe'] },
				{ executable: ['ms-teams.exe', 'teams.exe'] },
				{
					allOf: [
						{ name: ['microsoft teams'] },
						{ publisherContains: ['microsoft'] },
					],
				},
				{ name: ['microsoft teams'] },
			],
		},
		aliases: [
			['teams', 'strong'],
			['ms teams', 'normal'],
			['тимс', 'normal'],
		],
	},
	{
		id: 'zoom',
		match: {
			anyOf: [
				{ executable: ['zoom.exe'] },
				{
					allOf: [
						{ name: ['zoom', 'zoom workplace'] },
						{ publisherContains: ['zoom'] },
					],
				},
				{ name: ['zoom', 'zoom workplace'] },
			],
		},
		aliases: [
			['zoom', 'strong'],
			['зум', 'normal'],
		],
	},
	{
		id: 'whatsapp',
		match: {
			anyOf: [
				{ executable: ['whatsapp.exe'] },
				{ packageFamily: ['5319275a.whatsappdesktop_cv1g1gvanyjgm'] },
				{
					allOf: [
						{
							productNameStartsWith: [
								'whatsapp',
								'5319275a.whatsappdesktop',
							],
						},
						{ publisherContains: ['whatsapp', 'meta'] },
					],
				},
				{ name: ['whatsapp'] },
			],
		},
		aliases: [
			['whatsapp', 'strong'],
			['ватсап', 'normal'],
			['вацап', 'weak'],
		],
	},
	{
		id: 'viber',
		match: { anyOf: [{ executable: ['viber.exe'] }, { name: ['viber'] }] },
		aliases: [
			['viber', 'strong'],
			['вайбер', 'normal'],
		],
	},
	{
		id: 'skype',
		match: { anyOf: [{ executable: ['skype.exe'] }, { name: ['skype'] }] },
		aliases: [
			['skype', 'strong'],
			['скайп', 'normal'],
		],
	},
	{
		id: 'anydesk',
		match: {
			anyOf: [{ executable: ['anydesk.exe'] }, { name: ['anydesk'] }],
		},
		aliases: [
			['anydesk', 'strong'],
			['any desk', 'normal'],
			['энидеск', 'weak'],
		],
	},
	{
		id: 'teamviewer',
		match: {
			anyOf: [
				{ executable: ['teamviewer.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['teamviewer'] },
						{ originalFilename: ['teamviewer.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['teamviewer'] },
						{ publisherContains: ['teamviewer'] },
					],
				},
				{ name: ['teamviewer'] },
			],
		},
		aliases: [['teamviewer', 'strong']],
	},
	{
		id: 'thunderbird',
		match: {
			anyOf: [
				{ executable: ['thunderbird.exe'] },
				{
					allOf: [
						{
							nameStartsWith: [
								'thunderbird',
								'mozilla thunderbird',
							],
						},
						{ publisherContains: ['mozilla'] },
					],
				},
				{ name: ['thunderbird', 'mozilla thunderbird'] },
			],
		},
		aliases: [['thunderbird', 'strong']],
	},
	{
		id: 'outlook',
		match: {
			anyOf: [
				{ executable: ['outlook.exe', 'olk.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['outlook', 'microsoft outlook'] },
						{ originalFilename: ['outlook.exe', 'olk.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['outlook 20', 'microsoft outlook'] },
						{ publisherContains: ['microsoft'] },
					],
				},
				{ name: ['outlook', 'microsoft outlook'] },
			],
		},
		aliases: [
			['outlook', 'strong'],
			['аутлук', 'normal'],
		],
	},
]
