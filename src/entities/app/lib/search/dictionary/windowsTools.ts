import type { KnownAppAliasEntry } from '../types'

const MICROSOFT = ['microsoft'] as const

export const WINDOWS_TOOLS: readonly KnownAppAliasEntry[] = [
	{
		id: 'command-prompt',
		match: {
			anyOf: [
				{ executable: ['cmd.exe'] },
				{
					allOf: [
						{ name: ['command prompt', 'командная строка'] },
						{ originalFilename: ['cmd.exe'] },
					],
				},
				{ name: ['command prompt', 'командная строка'] },
			],
			exclude: [
				{ nameStartsWith: ['git cmd', 'developer command prompt'] },
			],
		},
		aliases: [
			['cmd', 'strong'],
			['cmd.exe', 'normal'],
			['command prompt', 'strong'],
			['командная строка', 'strong'],
			['кмд', 'weak'],
		],
	},
	{
		id: 'windows-terminal',
		match: {
			anyOf: [
				{
					packageFamily: [
						'microsoft.windowsterminal_8wekyb3d8bbwe',
						'microsoft.windowsterminalpreview_8wekyb3d8bbwe',
					],
				},
				{ executable: ['windowsterminal.exe', 'wt.exe'] },
				{
					allOf: [
						{
							productName: [
								'windows terminal',
								'microsoft.windowsterminal',
							],
						},
						{ publisherContains: MICROSOFT },
					],
				},
				{ name: ['windows terminal', 'terminal', 'терминал'] },
			],
			exclude: [
				{ executable: ['openconsole.exe'] },
				{ originalFilename: ['openconsole.exe'] },
			],
		},
		aliases: [
			['wt', 'strong'],
			['windows terminal', 'strong'],
			['terminal', 'normal'],
		],
	},
	{
		id: 'windows-powershell',
		match: {
			anyOf: [
				{ executable: ['powershell.exe'] },
				{
					allOf: [
						{ name: ['windows powershell', 'powershell'] },
						{ originalFilename: ['powershell.exe'] },
					],
				},
				{ name: ['windows powershell', 'powershell'] },
			],
			exclude: [
				{ executable: ['powershell_ise.exe'] },
				{ originalFilename: ['powershell_ise.exe'] },
				{
					nameStartsWith: [
						'windows powershell ise',
						'powershell ise',
					],
				},
			],
		},
		aliases: [['powershell', 'strong']],
	},
	{
		id: 'powershell-ise',
		match: {
			anyOf: [
				{ executable: ['powershell_ise.exe'] },
				{
					allOf: [
						{ name: ['windows powershell ise', 'powershell ise'] },
						{ originalFilename: ['powershell_ise.exe'] },
					],
				},
				{ name: ['windows powershell ise', 'powershell ise'] },
			],
		},
		aliases: [
			['powershell ise', 'strong'],
			['ise', 'normal'],
		],
	},
	{
		id: 'powershell-7',
		match: {
			anyOf: [
				{ executable: ['pwsh.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['powershell 7'] },
						{ originalFilename: ['pwsh.exe', 'pwsh.dll'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['powershell 7'] },
						{ publisherContains: MICROSOFT },
					],
				},
			],
		},
		aliases: [
			['pwsh', 'strong'],
			['powershell', 'normal'],
		],
	},
	{
		id: 'task-manager',
		match: {
			anyOf: [
				{ executable: ['taskmgr.exe'] },
				{
					allOf: [
						{ name: ['task manager', 'диспетчер задач'] },
						{ originalFilename: ['taskmgr.exe'] },
					],
				},
				{ name: ['task manager', 'диспетчер задач'] },
			],
		},
		aliases: [
			['taskmgr', 'strong'],
			['task manager', 'strong'],
			['диспетчер задач', 'strong'],
		],
	},
	{
		id: 'registry-editor',
		match: {
			anyOf: [
				{ executable: ['regedit.exe'] },
				{
					allOf: [
						{ name: ['registry editor', 'редактор реестра'] },
						{ originalFilename: ['regedit.exe'] },
					],
				},
				{ name: ['registry editor', 'редактор реестра'] },
			],
		},
		aliases: [
			['regedit', 'strong'],
			['registry editor', 'strong'],
			['редактор реестра', 'strong'],
		],
	},
	{
		id: 'file-explorer',
		match: {
			anyOf: [
				{ executable: ['explorer.exe'] },
				{
					allOf: [
						{ name: ['file explorer', 'explorer', 'проводник'] },
						{ originalFilename: ['explorer.exe'] },
					],
				},
				{ name: ['file explorer', 'explorer', 'проводник'] },
			],
		},
		aliases: [
			['explorer', 'strong'],
			['explorer.exe', 'normal'],
			['file explorer', 'strong'],
			['проводник', 'strong'],
		],
	},
	{
		id: 'notepad',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.windowsnotepad_8wekyb3d8bbwe'] },
				{ executable: ['notepad.exe'] },
				{
					allOf: [
						{ name: ['notepad', 'блокнот'] },
						{ originalFilename: ['notepad.exe'] },
					],
				},
				{ name: ['notepad', 'блокнот'] },
				{ productName: ['microsoft.windowsnotepad'] },
			],
			exclude: [{ nameStartsWith: ['notepad++', 'notepad ++'] }],
		},
		aliases: [
			['notepad', 'strong'],
			['блокнот', 'strong'],
		],
	},
	{
		id: 'paint',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.paint_8wekyb3d8bbwe'] },
				{ executable: ['mspaint.exe'] },
				{
					allOf: [
						{ name: ['paint'] },
						{ originalFilename: ['mspaint.exe'] },
					],
				},
				{ name: ['paint'] },
				{ productName: ['microsoft.paint'] },
			],
			exclude: [{ nameStartsWith: ['paint.net', 'paint 3d'] }],
		},
		aliases: [
			['mspaint', 'strong'],
			['paint', 'strong'],
		],
	},
	{
		id: 'calculator',
		match: {
			anyOf: [
				{
					packageFamily: [
						'microsoft.windowscalculator_8wekyb3d8bbwe',
					],
				},
				{ executable: ['calc.exe', 'calculatorapp.exe'] },
				{ name: ['calculator', 'калькулятор'] },
				{ productName: ['microsoft.windowscalculator'] },
			],
		},
		aliases: [
			['calc', 'strong'],
			['calculator', 'strong'],
			['калькулятор', 'strong'],
			['кальк', 'weak'],
		],
	},
	{
		id: 'snipping-tool',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.screensketch_8wekyb3d8bbwe'] },
				{ executable: ['snippingtool.exe'] },
				{ name: ['snipping tool', 'ножницы'] },
				{ productName: ['microsoft.screensketch'] },
			],
		},
		aliases: [
			['snipping tool', 'strong'],
			['ножницы', 'strong'],
		],
	},
	{
		id: 'control-panel',
		match: {
			anyOf: [
				{ executable: ['control.exe'] },
				{
					allOf: [
						{ name: ['control panel', 'панель управления'] },
						{ originalFilename: ['control.exe'] },
					],
				},
				{ name: ['control panel', 'панель управления'] },
			],
		},
		aliases: [
			['control panel', 'strong'],
			['панель управления', 'strong'],
		],
	},
	{
		id: 'settings',
		match: {
			anyOf: [
				{
					packageFamily: [
						'windows.immersivecontrolpanel_cw5n1h2txyewy',
					],
				},
				{ executable: ['systemsettings.exe'] },
				{ name: ['settings', 'параметры', 'настройки'] },
				{ productName: ['windows.immersivecontrolpanel'] },
			],
		},
		aliases: [
			['settings', 'strong'],
			['параметры', 'strong'],
			['настройки', 'strong'],
		],
	},
	{
		id: 'run',
		match: { anyOf: [{ name: ['run', 'выполнить'] }] },
		aliases: [
			['run', 'normal'],
			['выполнить', 'normal'],
		],
	},
	{
		id: 'services',
		match: {
			anyOf: [
				{ executable: ['services.msc'] },
				{ name: ['services', 'службы'] },
			],
		},
		aliases: [
			['services', 'strong'],
			['services.msc', 'normal'],
			['службы', 'strong'],
		],
	},
	{
		id: 'task-scheduler',
		match: { anyOf: [{ name: ['task scheduler', 'планировщик задач'] }] },
		aliases: [
			['task scheduler', 'normal'],
			['taskschd', 'normal'],
			['планировщик задач', 'normal'],
		],
	},
	{
		id: 'event-viewer',
		match: { anyOf: [{ name: ['event viewer', 'просмотр событий'] }] },
		aliases: [
			['event viewer', 'normal'],
			['eventvwr', 'normal'],
			['просмотр событий', 'normal'],
		],
	},
	{
		id: 'computer-management',
		match: {
			anyOf: [
				{ name: ['computer management', 'управление компьютером'] },
			],
		},
		aliases: [
			['computer management', 'normal'],
			['compmgmt', 'normal'],
			['управление компьютером', 'normal'],
		],
	},
	{
		id: 'resource-monitor',
		match: {
			anyOf: [
				{ executable: ['resmon.exe'] },
				{
					allOf: [
						{ name: ['resource monitor', 'монитор ресурсов'] },
						{ originalFilename: ['resmon.exe', 'perfmon.exe'] },
					],
				},
				{ name: ['resource monitor', 'монитор ресурсов'] },
			],
		},
		aliases: [
			['resource monitor', 'strong'],
			['resmon', 'normal'],
			['монитор ресурсов', 'strong'],
		],
	},
	{
		id: 'disk-cleanup',
		match: {
			anyOf: [
				{ executable: ['cleanmgr.exe'] },
				{
					allOf: [
						{ name: ['disk cleanup', 'очистка диска'] },
						{ originalFilename: ['cleanmgr.exe'] },
					],
				},
				{ name: ['disk cleanup', 'очистка диска'] },
			],
		},
		aliases: [
			['disk cleanup', 'strong'],
			['cleanmgr', 'normal'],
			['очистка диска', 'strong'],
		],
	},
	{
		id: 'msconfig',
		match: {
			anyOf: [
				{ executable: ['msconfig.exe'] },
				{
					allOf: [
						{
							name: [
								'system configuration',
								'конфигурация системы',
							],
						},
						{ originalFilename: ['msconfig.exe'] },
					],
				},
				{ name: ['system configuration', 'конфигурация системы'] },
			],
		},
		aliases: [
			['msconfig', 'strong'],
			['system configuration', 'strong'],
			['конфигурация системы', 'strong'],
		],
	},
	{
		id: 'remote-desktop',
		match: {
			anyOf: [
				{ executable: ['mstsc.exe'] },
				{
					allOf: [
						{
							name: [
								'remote desktop connection',
								'подключение к удаленному рабочему столу',
							],
						},
						{ originalFilename: ['mstsc.exe'] },
					],
				},
				{
					name: [
						'remote desktop connection',
						'подключение к удаленному рабочему столу',
					],
				},
			],
		},
		aliases: [
			['mstsc', 'strong'],
			['rdp', 'strong'],
			['remote desktop', 'strong'],
			['удаленный рабочий стол', 'strong'],
		],
	},
	{
		id: 'on-screen-keyboard',
		match: {
			anyOf: [
				{ executable: ['osk.exe'] },
				{ name: ['on-screen keyboard', 'экранная клавиатура'] },
			],
		},
		aliases: [
			['osk', 'strong'],
			['on-screen keyboard', 'strong'],
			['экранная клавиатура', 'strong'],
		],
	},
	{
		id: 'magnifier',
		match: {
			anyOf: [
				{ executable: ['magnify.exe', 'screenmagnifier.exe'] },
				{ name: ['magnifier', 'экранная лупа'] },
			],
		},
		aliases: [
			['magnifier', 'strong'],
			['magnify', 'normal'],
			['лупа', 'strong'],
		],
	},
	{
		id: 'narrator',
		match: {
			anyOf: [
				{ executable: ['narrator.exe'] },
				{ name: ['narrator', 'экранный диктор'] },
			],
		},
		aliases: [
			['narrator', 'strong'],
			['диктор', 'strong'],
		],
	},
	{
		id: 'character-map',
		match: {
			anyOf: [
				{ executable: ['charmap.exe'] },
				{
					allOf: [
						{ name: ['character map', 'таблица символов'] },
						{ originalFilename: ['charmap.exe'] },
					],
				},
				{ name: ['character map', 'таблица символов'] },
			],
		},
		aliases: [
			['charmap', 'strong'],
			['character map', 'strong'],
			['таблица символов', 'strong'],
		],
	},
	{
		id: 'system-information',
		match: {
			anyOf: [
				{ executable: ['msinfo32.exe'] },
				{
					allOf: [
						{ name: ['system information', 'сведения о системе'] },
						{ originalFilename: ['msinfo32.exe'] },
					],
				},
				{ name: ['system information', 'сведения о системе'] },
			],
		},
		aliases: [
			['msinfo32', 'strong'],
			['msinfo', 'normal'],
			['system information', 'strong'],
			['сведения о системе', 'strong'],
		],
	},
	{
		id: 'defragment',
		match: {
			anyOf: [
				{ executable: ['dfrgui.exe'] },
				{
					name: [
						'defragment and optimize drives',
						'оптимизация дисков',
					],
				},
			],
		},
		aliases: [
			['defrag', 'strong'],
			['optimize drives', 'normal'],
			['оптимизация дисков', 'strong'],
		],
	},
	{
		id: 'memory-diagnostic',
		match: {
			anyOf: [
				{ executable: ['mdsched.exe'] },
				{
					name: [
						'windows memory diagnostic',
						'средство проверки памяти windows',
					],
				},
			],
		},
		aliases: [
			['mdsched', 'strong'],
			['memory diagnostic', 'strong'],
			['проверка памяти', 'strong'],
		],
	},
	{
		id: 'windows-security',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.sechealthui_8wekyb3d8bbwe'] },
				{ executable: ['sechealthui.exe'] },
				{ name: ['windows security', 'безопасность windows'] },
				{ productName: ['microsoft.sechealthui'] },
			],
		},
		aliases: [
			['windows security', 'strong'],
			['defender', 'strong'],
			['защитник', 'strong'],
		],
	},
	{
		id: 'microsoft-store',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.windowsstore_8wekyb3d8bbwe'] },
				{ name: ['microsoft store', 'магазин microsoft'] },
				{ productName: ['microsoft.windowsstore'] },
			],
		},
		aliases: [
			['store', 'strong'],
			['ms store', 'strong'],
			['microsoft store', 'strong'],
		],
	},
	{
		id: 'photos',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.windows.photos_8wekyb3d8bbwe'] },
				{ name: ['photos', 'фотографии'] },
				{ productName: ['microsoft.windows.photos'] },
			],
		},
		aliases: [
			['photos', 'strong'],
			['фотографии', 'strong'],
		],
	},
	{
		id: 'camera',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.windowscamera_8wekyb3d8bbwe'] },
				{ executable: ['windowscamera.exe'] },
				{ name: ['camera', 'камера'] },
				{ productName: ['microsoft.windowscamera'] },
			],
		},
		aliases: [
			['camera', 'strong'],
			['камера', 'strong'],
		],
	},
	{
		id: 'weather',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.bingweather_8wekyb3d8bbwe'] },
				{ name: ['weather', 'погода'] },
				{ productName: ['microsoft.bingweather'] },
			],
		},
		aliases: [
			['weather', 'strong'],
			['погода', 'strong'],
		],
	},
	{
		id: 'news',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.bingnews_8wekyb3d8bbwe'] },
				{ name: ['news', 'новости'] },
				{ productName: ['microsoft.bingnews'] },
			],
		},
		aliases: [
			['news', 'strong'],
			['новости', 'strong'],
		],
	},
	{
		id: 'sticky-notes',
		match: {
			anyOf: [
				{
					packageFamily: [
						'microsoft.microsoftstickynotes_8wekyb3d8bbwe',
					],
				},
				{ name: ['sticky notes', 'записки'] },
				{ productName: ['microsoft.microsoftstickynotes'] },
			],
		},
		aliases: [
			['sticky notes', 'strong'],
			['записки', 'strong'],
		],
	},
	{
		id: 'sound-recorder',
		match: {
			anyOf: [
				{
					packageFamily: [
						'microsoft.windowssoundrecorder_8wekyb3d8bbwe',
					],
				},
				{ executable: ['soundrec.exe'] },
				{ name: ['sound recorder', 'звукозапись'] },
				{ productName: ['microsoft.windowssoundrecorder'] },
			],
		},
		aliases: [
			['sound recorder', 'strong'],
			['звукозапись', 'strong'],
		],
	},
	{
		id: 'phone-link',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.yourphone_8wekyb3d8bbwe'] },
				{ name: ['phone link', 'связь с телефоном'] },
				{ productName: ['microsoft.yourphone'] },
			],
		},
		aliases: [
			['phone link', 'strong'],
			['your phone', 'normal'],
			['связь с телефоном', 'strong'],
		],
	},
	{
		id: 'feedback-hub',
		match: {
			anyOf: [
				{
					packageFamily: [
						'microsoft.windowsfeedbackhub_8wekyb3d8bbwe',
					],
				},
				{ name: ['feedback hub', 'центр отзывов'] },
				{ productName: ['microsoft.windowsfeedbackhub'] },
			],
		},
		aliases: [
			['feedback hub', 'strong'],
			['центр отзывов', 'strong'],
		],
	},
	{
		id: 'get-help',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.gethelp_8wekyb3d8bbwe'] },
				{ name: ['get help', 'техническая поддержка'] },
				{ productName: ['microsoft.gethelp'] },
			],
		},
		aliases: [
			['get help', 'strong'],
			['техническая поддержка', 'strong'],
		],
	},
	{
		id: 'microsoft-to-do',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.todos_8wekyb3d8bbwe'] },
				{ name: ['microsoft to do'] },
				{ productName: ['microsoft.todos'] },
			],
		},
		aliases: [
			['to do', 'strong'],
			['todo', 'strong'],
		],
	},
	{
		id: 'onedrive',
		match: {
			anyOf: [
				{ executable: ['onedrive.exe'] },
				{
					allOf: [
						{ productName: ['microsoft onedrive'] },
						{ publisherContains: MICROSOFT },
					],
				},
				{ name: ['onedrive', 'microsoft onedrive'] },
			],
		},
		aliases: [
			['onedrive', 'strong'],
			['one drive', 'normal'],
		],
	},
	{
		id: 'xbox',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.gamingapp_8wekyb3d8bbwe'] },
				{ executable: ['xboxpcapp.exe', 'xboxpcappce.exe'] },
				{ name: ['xbox'] },
				{ productName: ['microsoft.gamingapp'] },
			],
		},
		aliases: [
			['xbox', 'strong'],
			['xbox app', 'normal'],
			['иксбокс', 'weak'],
		],
	},
	{
		id: 'game-bar',
		match: {
			anyOf: [
				{
					packageFamily: [
						'microsoft.xboxgamingoverlay_8wekyb3d8bbwe',
					],
				},
				{ executable: ['gamebar.exe'] },
				{ name: ['game bar', 'xbox game bar'] },
				{ productName: ['microsoft.xboxgamingoverlay'] },
			],
		},
		aliases: [
			['game bar', 'strong'],
			['gamebar', 'strong'],
		],
	},
	{
		id: 'windows-media-player',
		match: {
			anyOf: [
				{ executable: ['wmplayer.exe'] },
				{
					allOf: [
						{
							name: [
								'windows media player',
								'windows media player legacy',
							],
						},
						{ originalFilename: ['wmplayer.exe'] },
					],
				},
				{
					name: [
						'windows media player',
						'windows media player legacy',
					],
				},
			],
		},
		aliases: [
			['wmp', 'strong'],
			['media player', 'normal'],
			['windows media player', 'strong'],
		],
	},
	{
		id: 'quick-assist',
		match: {
			anyOf: [
				{
					packageFamily: [
						'microsoftcorporationii.quickassist_8wekyb3d8bbwe',
					],
				},
				{ executable: ['quickassist.exe'] },
				{ name: ['quick assist', 'быстрая помощь'] },
				{ productName: ['microsoftcorporationii.quickassist'] },
			],
		},
		aliases: [
			['quick assist', 'strong'],
			['быстрая помощь', 'strong'],
		],
	},
	{
		id: 'wsl',
		match: {
			anyOf: [
				{ executable: ['wsl.exe'] },
				{ name: ['wsl', 'windows subsystem for linux'] },
				{ productName: ['windows subsystem for linux'] },
			],
		},
		aliases: [['wsl', 'strong']],
	},
	{
		id: 'dev-home',
		match: {
			anyOf: [
				{ packageFamily: ['microsoft.windows.devhome_8wekyb3d8bbwe'] },
				{ executable: ['devhome.exe'] },
				{ name: ['dev home'] },
				{ productName: ['microsoft.windows.devhome'] },
			],
		},
		aliases: [['devhome', 'strong']],
	},
	{
		id: 'power-automate',
		match: {
			anyOf: [
				{
					packageFamily: [
						'microsoft.powerautomatedesktop_8wekyb3d8bbwe',
					],
				},
				{ name: ['power automate'] },
				{ productName: ['microsoft.powerautomatedesktop'] },
			],
		},
		aliases: [['power automate', 'strong']],
	},
]
