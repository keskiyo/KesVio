import type { KnownAppAliasEntry } from '../types'

const BLIZZARD = ['blizzard'] as const
const VALVE = ['valve'] as const

export const MEDIA: readonly KnownAppAliasEntry[] = [
	{
		id: 'obs-studio',
		match: {
			anyOf: [
				{ executable: ['obs64.exe', 'obs32.exe'] },
				{
					allOf: [
						{ productName: ['obs studio'] },
						{ publisherContains: ['obs project'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['obs studio'] },
						{ originalFilename: ['obs64.exe', 'obs32.exe'] },
					],
				},
				{ name: ['obs studio'] },
				{ productName: ['obs studio'] },
			],
		},
		aliases: [
			['obs', 'strong'],
			['obs studio', 'strong'],
		],
	},
	{
		id: 'vlc',
		match: {
			anyOf: [
				{ executable: ['vlc.exe'] },
				{
					allOf: [
						{ productName: ['vlc media player'] },
						{ publisherContains: ['videolan'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['vlc media player'] },
						{ originalFilename: ['vlc.exe'] },
					],
				},
				{ name: ['vlc media player'] },
				{ productName: ['vlc media player'] },
			],
		},
		aliases: [
			['vlc', 'strong'],
			['влс', 'weak'],
		],
	},
	{
		id: 'spotify',
		match: {
			anyOf: [
				{ packageFamily: ['spotifyab.spotifymusic_zpdnekdrzrea0'] },
				{ executable: ['spotify.exe'] },
				{
					allOf: [
						{ name: ['spotify'] },
						{ publisherContains: ['spotify'] },
					],
				},
				{ name: ['spotify'] },
			],
		},
		aliases: [
			['spotify', 'strong'],
			['спотифай', 'normal'],
		],
	},
	{
		id: 'yandex-music',
		match: {
			anyOf: [
				{
					allOf: [
						{
							productNameStartsWith: [
								'yandex.music',
								'yandex music',
							],
						},
						{ publisherContains: ['yandex', 'яндекс'] },
					],
				},
				{ name: ['yandex music', 'яндекс музыка'] },
			],
		},
		aliases: [
			['yandex music', 'normal'],
			['яндекс музыка', 'normal'],
		],
	},
	{
		id: 'kmplayer',
		match: {
			anyOf: [
				{ executable: ['kmplayer.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['kmplayer'] },
						{ originalFilename: ['kmplayer.exe'] },
					],
				},
				{ name: ['kmplayer'] },
			],
		},
		aliases: [['kmplayer', 'strong']],
	},
	{
		id: 'mpc-hc',
		match: {
			anyOf: [
				{ executable: ['mpc-hc64.exe', 'mpc-hc.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['mpc-hc', 'media player classic'] },
						{ originalFilename: ['mpc-hc64.exe', 'mpc-hc.exe'] },
					],
				},
				{
					name: [
						'mpc-hc',
						'media player classic',
						'media player classic - home cinema',
					],
				},
			],
		},
		aliases: [
			['mpc', 'strong'],
			['media player classic', 'strong'],
		],
	},
	{
		id: 'potplayer',
		match: {
			anyOf: [
				{ executable: ['potplayermini64.exe', 'potplayermini.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['potplayer', 'daum potplayer'] },
						{
							originalFilename: [
								'potplayermini64.exe',
								'potplayermini.exe',
							],
						},
					],
				},
				{ name: ['potplayer', 'daum potplayer'] },
			],
		},
		aliases: [['potplayer', 'strong']],
	},
	{
		id: 'audacity',
		match: {
			anyOf: [{ executable: ['audacity.exe'] }, { name: ['audacity'] }],
		},
		aliases: [['audacity', 'strong']],
	},
	{
		id: 'handbrake',
		match: {
			anyOf: [{ executable: ['handbrake.exe'] }, { name: ['handbrake'] }],
		},
		aliases: [['handbrake', 'strong']],
	},
	{
		id: 'wallpaper-engine',
		match: {
			anyOf: [
				{ steamAppId: ['431960'] },
				{ executable: ['wallpaper64.exe', 'wallpaper32.exe'] },
				{ name: ['wallpaper engine'] },
				{ productName: ['wallpaper engine'] },
			],
		},
		aliases: [['wallpaper engine', 'strong']],
	},
	{
		id: 'yt-dlp',
		match: {
			anyOf: [{ executable: ['yt-dlp.exe'] }, { name: ['yt-dlp'] }],
		},
		aliases: [['ytdlp', 'strong']],
	},
	{
		id: 'clipchamp',
		match: {
			anyOf: [
				{ packageFamily: ['clipchamp.clipchamp_yxz26nhyzhsrt'] },
				{ name: ['microsoft clipchamp', 'clipchamp'] },
				{ productName: ['clipchamp.clipchamp'] },
			],
		},
		aliases: [['clipchamp', 'strong']],
	},
]

export const GAMING: readonly KnownAppAliasEntry[] = [
	{
		id: 'steam',
		match: {
			anyOf: [
				{ executable: ['steam.exe'] },
				{
					allOf: [
						{ productName: ['steam'] },
						{ publisherContains: VALVE },
					],
				},
				{
					allOf: [
						{ name: ['steam'] },
						{ originalFilename: ['steam.exe'] },
					],
				},
				{ name: ['steam'] },
			],
			exclude: [
				{
					executable: [
						'steamservice.exe',
						'steamwebhelper.exe',
						'steamerrorreporter.exe',
					],
				},
				{
					originalFilename: [
						'steamservice.exe',
						'steamwebhelper.exe',
						'steamerrorreporter.exe',
						'steamsetup.exe',
					],
				},
				{
					nameStartsWith: [
						'steam client bootstrapper',
						'steam client service',
						'steamworks',
						'steam support',
						'steam setup',
					],
				},
			],
		},
		aliases: [
			['steam', 'strong'],
			['стим', 'strong'],
		],
	},
	{
		id: 'battle-net',
		match: {
			anyOf: [
				{ executable: ['battle.net.exe', 'battle.net launcher.exe'] },
				{
					allOf: [
						{ productName: ['battle.net launcher', 'battle.net'] },
						{ publisherContains: BLIZZARD },
					],
				},
				{
					allOf: [
						{ name: ['battle.net'] },
						{
							originalFilename: [
								'battle.net launcher.exe',
								'battle.net.exe',
							],
						},
					],
				},
				{ name: ['battle.net'] },
			],
			exclude: [
				{
					executable: [
						'agent.exe',
						'battle.net-setup.exe',
						'blizzard error.exe',
					],
				},
				{ originalFilename: ['agent.exe', 'battle.net-setup.exe'] },
				{
					productName: [
						'battle.net setup',
						'blizzard agent',
						'battle.net update agent',
					],
				},
				{
					nameStartsWith: [
						'battle.net setup',
						'battle.net helper',
						'battle.net update',
						'blizzard agent',
					],
				},
			],
		},
		aliases: [
			['battle net', 'strong'],
			['battlenet', 'strong'],
			['bnet', 'normal'],
			['батл нет', 'normal'],
		],
	},
	{
		id: 'world-of-warcraft',
		match: {
			anyOf: [
				{ executable: ['wow.exe', 'world of warcraft launcher.exe'] },
				{
					allOf: [
						{ productNameStartsWith: ['world of warcraft'] },
						{ publisherContains: BLIZZARD },
					],
				},
				{ name: ['world of warcraft'] },
			],
		},
		aliases: [
			['wow', 'strong'],
			['warcraft', 'normal'],
			['вов', 'strong'],
			['варкрафт', 'normal'],
		],
	},
	{
		id: 'hearthstone',
		match: {
			anyOf: [
				{ executable: ['hearthstone.exe'] },
				{
					allOf: [
						{ productNameStartsWith: ['hearthstone'] },
						{ publisherContains: BLIZZARD },
					],
				},
				{ name: ['hearthstone'] },
			],
		},
		aliases: [
			['hs', 'weak'],
			['хартстоун', 'normal'],
		],
	},
	{
		id: 'overwatch',
		match: {
			anyOf: [
				{ executable: ['overwatch.exe', 'overwatch launcher.exe'] },
				{
					allOf: [
						{ productNameStartsWith: ['overwatch'] },
						{ publisherContains: BLIZZARD },
					],
				},
				{ name: ['overwatch', 'overwatch 2'] },
			],
		},
		aliases: [
			['ow', 'weak'],
			['овервотч', 'normal'],
		],
	},
	{
		id: 'diablo',
		match: {
			anyOf: [
				{
					executable: [
						'diablo iv.exe',
						'diablo iv launcher.exe',
						'diablo iii.exe',
					],
				},
				{
					allOf: [
						{ productNameStartsWith: ['diablo'] },
						{ publisherContains: BLIZZARD },
					],
				},
				{ name: ['diablo iv', 'diablo iii', 'diablo ii: resurrected'] },
			],
		},
		aliases: [['diablo', 'strong']],
	},
	{
		id: 'epic-games',
		match: {
			anyOf: [
				{ executable: ['epicgameslauncher.exe'] },
				{
					allOf: [
						{ name: ['epic games launcher'] },
						{ publisherContains: ['epic games'] },
					],
				},
				{ name: ['epic games launcher'] },
			],
		},
		aliases: [
			['epic', 'strong'],
			['epic games', 'strong'],
			['egs', 'weak'],
			['эпик', 'normal'],
		],
	},
	{
		id: 'ea-app',
		match: {
			anyOf: [
				{ executable: ['eadesktop.exe'] },
				{
					allOf: [
						{ name: ['ea app', 'ea', 'origin'] },
						{ publisherContains: ['electronic arts'] },
					],
				},
				{ name: ['ea app'] },
			],
		},
		aliases: [
			['ea', 'strong'],
			['ea app', 'strong'],
			['origin', 'normal'],
		],
	},
	{
		id: 'ubisoft-connect',
		match: {
			anyOf: [
				{ executable: ['ubisoftconnect.exe', 'upc.exe'] },
				{
					allOf: [
						{ name: ['ubisoft connect', 'uplay'] },
						{ publisherContains: ['ubisoft'] },
					],
				},
				{ name: ['ubisoft connect', 'uplay'] },
			],
		},
		aliases: [
			['ubisoft', 'strong'],
			['uplay', 'strong'],
			['юбисофт', 'weak'],
		],
	},
	{
		id: 'gog-galaxy',
		match: {
			anyOf: [
				{ executable: ['galaxyclient.exe'] },
				{
					allOf: [
						{ name: ['gog galaxy'] },
						{ publisherContains: ['gog'] },
					],
				},
				{ name: ['gog galaxy'] },
			],
		},
		aliases: [['gog', 'strong']],
	},
	{
		id: 'riot-client',
		match: {
			anyOf: [
				{ executable: ['riotclientservices.exe'] },
				{
					allOf: [
						{ name: ['riot client'] },
						{ publisherContains: ['riot'] },
					],
				},
				{ name: ['riot client'] },
			],
		},
		aliases: [['riot', 'strong']],
	},
	{
		id: 'league-of-legends',
		match: {
			anyOf: [
				{ executable: ['leagueclient.exe'] },
				{
					allOf: [
						{ name: ['league of legends'] },
						{ publisherContains: ['riot'] },
					],
				},
				{ name: ['league of legends'] },
			],
		},
		aliases: [['lol', 'strong']],
	},
	{
		id: 'valorant',
		match: {
			anyOf: [{ executable: ['valorant.exe'] }, { name: ['valorant'] }],
		},
		aliases: [['valorant', 'strong']],
	},
	{
		id: 'counter-strike',
		match: {
			anyOf: [
				{ steamAppId: ['730'] },
				{ executable: ['cs2.exe', 'csgo.exe'] },
				{
					name: [
						'counter-strike 2',
						'counter-strike: global offensive',
					],
				},
			],
		},
		aliases: [
			['cs2', 'strong'],
			['csgo', 'strong'],
			['counter strike', 'strong'],
			['кс', 'normal'],
			['контра', 'normal'],
		],
	},
	{
		id: 'dota-2',
		match: {
			anyOf: [
				{ steamAppId: ['570'] },
				{ executable: ['dota2.exe'] },
				{ name: ['dota 2'] },
			],
		},
		aliases: [['dota', 'strong']],
	},
	{
		id: 'minecraft',
		match: {
			anyOf: [
				{ executable: ['minecraft.exe', 'minecraftlauncher.exe'] },
				{
					packageFamily: ['microsoft.4297127d64ec6_8wekyb3d8bbwe'],
				},
				{
					allOf: [
						{ nameStartsWith: ['minecraft'] },
						{
							originalFilename: [
								'minecraft.exe',
								'minecraftlauncher.exe',
							],
						},
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['minecraft'] },
						{ publisherContains: ['mojang', 'microsoft'] },
					],
				},
				{ name: ['minecraft', 'minecraft launcher'] },
			],
		},
		aliases: [
			['minecraft', 'strong'],
			['майнкрафт', 'strong'],
			['майн', 'weak'],
		],
	},
	{
		id: 'roblox',
		match: {
			anyOf: [
				{ executable: ['robloxplayerbeta.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['roblox'] },
						{ publisherContains: ['roblox'] },
					],
				},
				{ name: ['roblox', 'roblox player'] },
			],
		},
		aliases: [
			['roblox', 'strong'],
			['роблокс', 'normal'],
		],
	},
	{
		id: 'curseforge',
		match: {
			anyOf: [
				{ executable: ['curseforge.exe'] },
				{ name: ['curseforge'] },
				{ productName: ['curseforge'] },
			],
		},
		aliases: [['curseforge', 'strong']],
	},
]
