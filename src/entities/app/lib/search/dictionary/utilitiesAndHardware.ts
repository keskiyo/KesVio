import type { KnownAppAliasEntry } from '../types'

export const UTILITIES: readonly KnownAppAliasEntry[] = [
	{
		id: '7-zip',
		match: {
			anyOf: [
				{ executable: ['7zfm.exe', '7zg.exe'] },
				{
					allOf: [
						{ productName: ['7-zip'] },
						{ publisherContains: ['igor pavlov'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['7-zip'] },
						{ originalFilename: ['7zfm.exe', '7zg.exe'] },
					],
				},
				{ name: ['7-zip', '7-zip file manager'] },
			],
		},
		aliases: [
			['7zip', 'strong'],
			['7-zip', 'strong'],
			['7z', 'normal'],
		],
	},
	{
		id: 'winrar',
		match: {
			anyOf: [
				{ executable: ['winrar.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['winrar'] },
						{ originalFilename: ['winrar.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['winrar'] },
						{
							publisherContains: [
								'win.rar',
								'rarlab',
								'alexander roshal',
							],
						},
					],
				},
				{ name: ['winrar'] },
			],
		},
		aliases: [
			['winrar', 'strong'],
			['винрар', 'normal'],
		],
	},
	{
		id: 'notepad-plus-plus',
		match: {
			anyOf: [
				{ executable: ['notepad++.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['notepad++'] },
						{ originalFilename: ['notepad++.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['notepad++'] },
						{ publisherContains: ['notepad++', 'don ho'] },
					],
				},
				{ name: ['notepad++'] },
			],
		},
		aliases: [
			['notepad++', 'strong'],
			['npp', 'normal'],
		],
	},
	{
		id: 'powertoys',
		match: {
			anyOf: [
				{ executable: ['powertoys.exe'] },
				{
					allOf: [
						{ productName: ['powertoys'] },
						{ publisherContains: ['microsoft'] },
					],
				},
				{ name: ['powertoys', 'powertoys (preview)'] },
			],
		},
		aliases: [
			['powertoys', 'strong'],
			['power toys', 'normal'],
		],
	},
	{
		id: 'everything',
		match: {
			anyOf: [
				{ executable: ['everything.exe', 'everything64.exe'] },
				{
					allOf: [
						{ name: ['everything'] },
						{ publisherContains: ['voidtools'] },
					],
				},
				{ name: ['everything'] },
			],
		},
		aliases: [['everything', 'strong']],
	},
	{
		id: 'sharex',
		match: {
			anyOf: [{ executable: ['sharex.exe'] }, { name: ['sharex'] }],
		},
		aliases: [['sharex', 'strong']],
	},
	{
		id: 'rufus',
		match: {
			anyOf: [
				{ executable: ['rufus.exe'] },
				{ name: ['rufus'] },
				{ productName: ['rufus'] },
			],
		},
		aliases: [['rufus', 'strong']],
	},
	{
		id: 'utorrent',
		match: {
			anyOf: [
				{ executable: ['utorrent.exe', 'utweb.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['utorrent', 'µtorrent'] },
						{ originalFilename: ['utorrent.exe', 'utweb.exe'] },
					],
				},
				{ name: ['utorrent', 'µtorrent', 'utorrent web'] },
			],
		},
		aliases: [['utorrent', 'strong']],
	},
	{
		id: 'qbittorrent',
		match: {
			anyOf: [
				{ executable: ['qbittorrent.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['qbittorrent'] },
						{ originalFilename: ['qbittorrent.exe'] },
					],
				},
				{ name: ['qbittorrent'] },
			],
		},
		aliases: [['qbittorrent', 'strong']],
	},
	{
		id: 'kaspersky-virus-removal-tool',
		match: {
			anyOf: [
				{
					executable: [
						'kaspersky virus removal tool.exe',
						'kvrt.exe',
					],
				},
				{ name: ['kaspersky virus removal tool'] },
			],
		},
		aliases: [
			['kvrt', 'strong'],
			['kaspersky', 'normal'],
			['касперский', 'normal'],
		],
	},
	{
		id: 'windhawk',
		match: {
			anyOf: [{ executable: ['windhawk.exe'] }, { name: ['windhawk'] }],
		},
		aliases: [['windhawk', 'strong']],
	},
	{
		id: 'total-commander',
		match: {
			anyOf: [
				{ executable: ['totalcmd64.exe', 'totalcmd.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['total commander'] },
						{
							originalFilename: [
								'totalcmd64.exe',
								'totalcmd.exe',
							],
						},
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['total commander'] },
						{ publisherContains: ['ghisler'] },
					],
				},
				{ name: ['total commander'] },
			],
		},
		aliases: [
			['total commander', 'strong'],
			['totalcmd', 'strong'],
			['тотал', 'weak'],
		],
	},
	{
		id: 'ccleaner',
		match: {
			anyOf: [
				{ executable: ['ccleaner64.exe', 'ccleaner.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['ccleaner'] },
						{
							originalFilename: [
								'ccleaner64.exe',
								'ccleaner.exe',
							],
						},
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['ccleaner'] },
						{ publisherContains: ['piriform', 'gen digital'] },
					],
				},
				{ name: ['ccleaner'] },
			],
		},
		aliases: [['ccleaner', 'strong']],
	},
	{
		id: 'amnezia-vpn',
		match: {
			anyOf: [
				{ executable: ['amneziavpn.exe'] },
				{ name: ['amneziavpn', 'amnezia vpn'] },
			],
		},
		aliases: [['amnezia', 'strong']],
	},
	{
		id: 'hiddify',
		match: {
			anyOf: [
				{ executable: ['hiddify.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['hiddify'] },
						{ originalFilename: ['hiddify.exe'] },
					],
				},
				{ name: ['hiddify', 'hiddify next'] },
			],
		},
		aliases: [['hiddify', 'strong']],
	},
	{
		id: 'oo-shutup',
		match: {
			anyOf: [
				{ executable: ['oosu10.exe'] },
				{ name: ['o&o shutup10++', 'o&o shutup10'] },
			],
		},
		aliases: [
			['shutup', 'strong'],
			['shutup10', 'strong'],
			['oosu', 'normal'],
		],
	},
	{
		id: 'google-drive',
		match: {
			anyOf: [
				{ executable: ['googledrivefs.exe'] },
				{
					allOf: [
						{ name: ['google drive'] },
						{ publisherContains: ['google'] },
					],
				},
				{ name: ['google drive'] },
			],
		},
		aliases: [
			['google drive', 'strong'],
			['gdrive', 'normal'],
			['гугл диск', 'normal'],
		],
	},
	{
		id: 'yandex-disk',
		match: {
			anyOf: [
				{
					allOf: [
						{
							productNameStartsWith: [
								'yandex.disk',
								'yandex disk',
							],
						},
						{ publisherContains: ['yandex', 'яндекс'] },
					],
				},
				{ name: ['yandex disk', 'яндекс диск', 'yandex.disk'] },
			],
		},
		aliases: [
			['yandex disk', 'normal'],
			['яндекс диск', 'normal'],
		],
	},
]

export const HARDWARE: readonly KnownAppAliasEntry[] = [
	{
		id: 'msi-afterburner',
		match: {
			anyOf: [
				{ executable: ['msiafterburner.exe'] },
				{ name: ['msi afterburner'] },
				{ productName: ['msiafterburner'] },
			],
		},
		aliases: [
			['afterburner', 'strong'],
			['msi afterburner', 'strong'],
			['афтербернер', 'weak'],
		],
	},
	{
		id: 'rivatuner',
		match: {
			anyOf: [
				{ executable: ['rtss.exe'] },
				{ name: ['rivatuner statistics server'] },
				{ productName: ['rtss'] },
			],
		},
		aliases: [
			['rtss', 'strong'],
			['rivatuner', 'strong'],
		],
	},
	{
		id: 'cpu-z',
		match: {
			anyOf: [
				{ executable: ['cpuz.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['cpu-z'] },
						{ originalFilename: ['cpuz.exe'] },
					],
				},
				{ name: ['cpu-z'] },
				{ productName: ['cpu-z application'] },
			],
		},
		aliases: [
			['cpuz', 'strong'],
			['cpu-z', 'strong'],
		],
	},
	{
		id: 'gpu-z',
		match: {
			anyOf: [
				{ executable: ['gpu-z.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['gpu-z'] },
						{ originalFilename: ['gpu-z.exe'] },
					],
				},
				{ name: ['gpu-z', 'techpowerup gpu-z'] },
			],
		},
		aliases: [
			['gpuz', 'strong'],
			['gpu-z', 'strong'],
		],
	},
	{
		id: 'hwinfo',
		match: {
			anyOf: [
				{ executable: ['hwinfo64.exe', 'hwinfo32.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['hwinfo'] },
						{ originalFilename: ['hwinfo64.exe', 'hwinfo32.exe'] },
					],
				},
				{ name: ['hwinfo', 'hwinfo64', 'hwinfo32'] },
			],
		},
		aliases: [['hwinfo', 'strong']],
	},
	{
		id: 'aida64',
		match: {
			anyOf: [
				{ executable: ['aida64.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['aida64'] },
						{ originalFilename: ['aida64.exe'] },
					],
				},
				{ name: ['aida64', 'aida64 extreme', 'aida64 engineer'] },
			],
		},
		aliases: [
			['aida', 'strong'],
			['aida64', 'strong'],
		],
	},
	{
		id: 'crystaldiskinfo',
		match: {
			anyOf: [
				{
					executable: [
						'diskinfo.exe',
						'diskinfo64.exe',
						'diskinfo64a.exe',
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['crystaldiskinfo'] },
						{
							originalFilename: [
								'diskinfo.exe',
								'diskinfo64.exe',
							],
						},
					],
				},
				{ name: ['crystaldiskinfo'] },
			],
		},
		aliases: [
			['crystaldiskinfo', 'strong'],
			['diskinfo', 'strong'],
			['cdi', 'weak'],
		],
	},
	{
		id: 'crystaldiskmark',
		match: {
			anyOf: [
				{ executable: ['diskmark.exe', 'diskmark64.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['crystaldiskmark'] },
						{
							originalFilename: [
								'diskmark.exe',
								'diskmark64.exe',
							],
						},
					],
				},
				{ name: ['crystaldiskmark'] },
			],
		},
		aliases: [
			['crystaldiskmark', 'strong'],
			['diskmark', 'strong'],
			['cdm', 'weak'],
		],
	},
	{
		id: 'hard-disk-sentinel',
		match: {
			anyOf: [
				{ executable: ['hdsentinel.exe'] },
				{ name: ['hard disk sentinel'] },
			],
		},
		aliases: [['hdsentinel', 'strong']],
	},
	{
		id: 'furmark',
		match: {
			anyOf: [
				{ executable: ['furmark.exe', 'furmark_gui.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['furmark'] },
						{
							originalFilename: [
								'furmark.exe',
								'furmark_gui.exe',
							],
						},
					],
				},
				{ name: ['furmark', 'furmark 2'] },
			],
		},
		aliases: [['furmark', 'strong']],
	},
	{
		id: 'occt',
		match: { anyOf: [{ executable: ['occt.exe'] }, { name: ['occt'] }] },
		aliases: [['occt', 'strong']],
	},
	{
		id: 'nvidia-app',
		match: {
			anyOf: [
				{ executable: ['nvidia app.exe'] },
				{
					allOf: [
						{ productName: ['nvidia app'] },
						{ publisherContains: ['nvidia'] },
					],
				},
				{ name: ['nvidia app'] },
			],
		},
		aliases: [
			['nvidia', 'strong'],
			['geforce', 'normal'],
		],
	},
	{
		id: 'nvidia-control-panel',
		match: {
			anyOf: [
				{
					packageFamily: [
						'nvidiacorp.nvidiacontrolpanel_56jybvy8sckqj',
					],
				},
				{ name: ['nvidia control panel'] },
				{ productName: ['nvidiacorp.nvidiacontrolpanel'] },
			],
		},
		aliases: [
			['nvidia control panel', 'strong'],
			['nvidia', 'normal'],
		],
	},
	{
		id: 'amd-software',
		match: {
			anyOf: [
				{ executable: ['radeonsoftware.exe'] },
				{
					allOf: [
						{ productNameStartsWith: ['advancedmicrodevicesinc'] },
						{
							publisherContains: [
								'advanced micro devices',
								'amd',
							],
						},
					],
				},
				{ name: ['amd software', 'amd software: adrenalin edition'] },
			],
		},
		aliases: [
			['amd', 'strong'],
			['radeon', 'strong'],
			['adrenalin', 'strong'],
		],
	},
	{
		id: 'msi-center',
		match: {
			anyOf: [
				{
					allOf: [
						{
							productNameStartsWith: [
								'9426micro-starinternation.msicenter',
							],
						},
						{ publisherContains: ['micro-star', 'msi'] },
					],
				},
				{ name: ['msi center'] },
			],
		},
		aliases: [['msi center', 'normal']],
	},
	{
		id: 'logitech-g-hub',
		match: {
			anyOf: [
				{ executable: ['lghub.exe'] },
				{
					allOf: [
						{ productName: ['g hub'] },
						{ publisherContains: ['logitech'] },
					],
				},
				{ name: ['logitech g hub'] },
			],
		},
		aliases: [
			['ghub', 'strong'],
			['g hub', 'strong'],
		],
	},
	{
		id: 'realtek-audio-console',
		match: {
			anyOf: [
				{
					packageFamily: [
						'realteksemiconductorcorp.realtekaudiocontrol_dt26b99r8h8gj',
					],
				},
				{ executable: ['rtkuwp.exe'] },
				{ name: ['realtek audio console'] },
				{
					productName: [
						'realteksemiconductorcorp.realtekaudiocontrol',
					],
				},
			],
		},
		aliases: [['realtek', 'strong']],
	},
	{
		id: 'bginfo',
		match: {
			anyOf: [{ executable: ['bginfo.exe'] }, { name: ['bginfo'] }],
		},
		aliases: [['bginfo', 'strong']],
	},
]
