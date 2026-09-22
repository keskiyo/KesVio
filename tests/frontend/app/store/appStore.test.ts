import { describe, expect, it, vi } from 'vitest'
import {
	PREFERENCES_BACKUP_KEY,
	PREFERENCES_KEY,
} from '../../../../src/app/store/preferences'
import { AppClientError } from '../../../../src/shared/api/tauri/errors'
import {
	createAppStore,
	selectFilteredApps,
	selectVisibleApps,
} from '../../../../src/app/store/appStore'
import type {
	AppInfo,
	AppsClient,
	CatalogDiagnostics,
} from '../../../../src/entities/app'
import {
	CUSTOM_CATEGORY_ACCENTS,
	stableCustomCategoryAccent,
} from '../../../../src/entities/category'

function memoryStorage(): Storage {
	const values = new Map<string, string>()
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value),
	} as unknown as Storage
}

function app(
	value: Partial<AppInfo> &
		Pick<AppInfo, 'id' | 'name' | 'path' | 'category'>,
): AppInfo {
	return {
		iconBase64: null,
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		...value,
	}
}

const apps: AppInfo[] = [
	app({
		id: 'code',
		name: 'Visual Studio Code',
		path: 'C:\\Code.exe',
		category: 'development',
		description: 'Editor by Microsoft',
	}),
	app({
		id: 'chrome',
		name: 'Google Chrome',
		path: 'C:\\Chrome.exe',
		iconBase64: 'data:image/png;base64,abc',
		category: 'browsers',
		publisher: 'Google',
	}),
	app({
		id: 'codex',
		name: 'Codex',
		path: 'OpenAI.Codex!App',
		category: 'ai',
		launchKind: 'app_user_model_id',
		sourceKind: 'start_apps',
		publisher: 'OpenAI',
	}),
]

function client(overrides: Partial<AppsClient> = {}): AppsClient {
	return {
		getApps: vi.fn().mockResolvedValue({ apps, hasCache: true }),
		refreshApps: vi
			.fn()
			.mockResolvedValue({ apps: apps.slice().reverse(), generation: 1 }),
		resetCatalogCache: vi
			.fn()
			.mockResolvedValue({ apps: [apps[2]], generation: 2 }),
		hydrateVisibleIcons: vi.fn().mockResolvedValue(undefined),
		cancelScan: vi.fn().mockResolvedValue(undefined),
		launchApp: vi.fn().mockResolvedValue(undefined),
		closeApps: vi.fn().mockResolvedValue({
			closed: 0,
			notRunning: 0,
			unavailable: 0,
			failed: 0,
		}),
		onScanProgress: vi.fn().mockResolvedValue(() => undefined),
		...overrides,
		getAppDetails:
			overrides.getAppDetails ??
			vi.fn().mockResolvedValue({
				fileSizeBytes: null,
				fileCreatedAt: null,
				fileModifiedAt: null,
				architecture: 'unknown',
				signature: 'unavailable',
				executableExists: null,
				installLocationExists: null,
			}),
		openAppFolder:
			overrides.openAppFolder ?? vi.fn().mockResolvedValue(undefined),
	}
}

describe('app store', () => {
	it('starts at the stored density and persists a change', () => {
		const values = new Map<string, string>()
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) =>
				void values.set(key, value),
		} as unknown as Storage
		const store = createAppStore(client(), storage)

		expect(store.getState().catalogDensity).toBe('compact')

		store.getState().setCatalogDensity('dense')

		expect(store.getState().catalogDensity).toBe('dense')
		expect(JSON.parse(values.get(PREFERENCES_KEY) ?? '{}')).toMatchObject({
			catalogDensity: 'dense',
		})
	})

	it('leaves state untouched when the density is already selected', () => {
		const store = createAppStore(client(), memoryStorage())
		const before = store.getState()

		before.setCatalogDensity('compact')

		expect(store.getState().catalogDensity).toBe('compact')
		expect(store.getState().apps).toBe(before.apps)
	})

	it('imports normalized preferences and keeps the previous state as the local backup', () => {
		const values = new Map<string, string>()
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) =>
				void values.set(key, value),
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		store.setState({ favoriteAppIds: ['before'] })
		store.getState().toggleCategory('games')

		const source = JSON.stringify({
			version: 15,
			favoriteAppIds: ['code'],
			hiddenAppIds: ['chrome'],
			importedField: 'kept',
		})

		expect(store.getState().validatePreferencesImport(source)).toEqual({
			ok: true,
		})
		expect(store.getState().importPreferences(source)).toEqual({ ok: true })
		expect(store.getState().favoriteAppIds).toEqual(['code'])
		expect(store.getState().hiddenAppIds).toEqual(['chrome'])
		expect(JSON.parse(values.get(PREFERENCES_KEY) ?? '{}')).toMatchObject({
			importedField: 'kept',
		})
		expect(JSON.parse(store.getState().exportPreferences())).toMatchObject({
			version: 22,
			favoriteAppIds: ['code'],
			hiddenAppIds: ['chrome'],
			importedField: 'kept',
		})
		expect(
			JSON.parse(values.get(PREFERENCES_BACKUP_KEY) ?? '{}'),
		).toMatchObject({ favoriteAppIds: ['before'] })
	})

	it('restores the rotating local preference backup', () => {
		const values = new Map<string, string>([
			[
				PREFERENCES_KEY,
				JSON.stringify({ version: 14, favoriteAppIds: ['now'] }),
			],
			[
				PREFERENCES_BACKUP_KEY,
				JSON.stringify({ version: 14, favoriteAppIds: ['before'] }),
			],
		])
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) =>
				void values.set(key, value),
		} as unknown as Storage
		const store = createAppStore(client(), storage)

		expect(store.getState().restorePreferencesBackup()).toEqual({
			ok: true,
		})
		expect(store.getState().favoriteAppIds).toEqual(['before'])
	})

	it('reports whether a valid local preference backup is available', () => {
		const missing = createAppStore(client(), memoryStorage())
		expect(missing.getState().hasPreferencesBackup()).toBe(false)

		const malformedStorage = memoryStorage()
		malformedStorage.setItem(PREFERENCES_BACKUP_KEY, '{invalid')
		const malformed = createAppStore(client(), malformedStorage)
		expect(malformed.getState().hasPreferencesBackup()).toBe(false)

		const validStorage = memoryStorage()
		validStorage.setItem(
			PREFERENCES_BACKUP_KEY,
			JSON.stringify({ version: 14 }),
		)
		const valid = createAppStore(client(), validStorage)
		expect(valid.getState().hasPreferencesBackup()).toBe(true)
	})

	it('carries a custom category through an export and back', () => {
		const stable = stableCustomCategoryAccent('custom:work')
		const chosen = CUSTOM_CATEGORY_ACCENTS.find(
			accent => accent !== stable,
		)!
		const store = createAppStore(client(), memoryStorage())
		store.setState({
			categories: [
				...store.getState().categories,
				{
					id: 'custom:work',
					label: 'Work',
					builtIn: false,
					accent: chosen,
				},
			],
			categoryOrder: [...store.getState().categoryOrder, 'custom:work'],
		})

		const restored = createAppStore(client(), memoryStorage())
		expect(
			restored
				.getState()
				.importPreferences(store.getState().exportPreferences()),
		).toEqual({ ok: true })

		expect(restored.getState().categories).toContainEqual({
			id: 'custom:work',
			label: 'Work',
			builtIn: false,
			accent: chosen,
		})
		expect(restored.getState().categoryOrder).toContain('custom:work')
	})

	it('redeals accents from a backup written before the palette widened', () => {
		const store = createAppStore(client(), memoryStorage())

		expect(
			store.getState().importPreferences(
				JSON.stringify({
					version: 16,
					categories: [
						{
							id: 'custom:work',
							label: 'Work',
							builtIn: false,
							accent: 'red',
						},
					],
					categoryOrder: ['custom:work'],
				}),
			),
		).toEqual({ ok: true })

		expect(store.getState().categories).toContainEqual({
			id: 'custom:work',
			label: 'Work',
			builtIn: false,
			accent: stableCustomCategoryAccent('custom:work'),
		})
		expect(store.getState().categoryOrder).toContain('custom:work')
	})

	it('refuses import and restore when local preferences use a newer schema', () => {
		const future = JSON.stringify({
			version: 23,
			favoriteAppIds: ['keep'],
		})
		const values = new Map<string, string>([
			[PREFERENCES_KEY, future],
			[
				PREFERENCES_BACKUP_KEY,
				JSON.stringify({ version: 14, favoriteAppIds: ['backup'] }),
			],
		])
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) =>
				void values.set(key, value),
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		const expected = {
			ok: false as const,
			error: 'Settings cannot be replaced by this version of KesVio.',
		}

		expect(
			store
				.getState()
				.importPreferences(
					'{"version":14,"favoriteAppIds":["imported"]}',
				),
		).toEqual(expected)
		expect(store.getState().favoriteAppIds).toEqual(['keep'])
		expect(store.getState().restorePreferencesBackup()).toEqual(expected)
		expect(store.getState().favoriteAppIds).toEqual(['keep'])
		expect(values.get(PREFERENCES_KEY)).toBe(future)
	})

	it('keeps a scanner-detected artifact locked to its bucket', () => {
		const installer = app({
			id: 'setup',
			name: 'Editor Setup',
			path: String.raw`C:\Downloads\setup.exe`,
			category: 'installers_docs',
			artifactKind: 'installer',
		})
		const store = createAppStore(client())
		store.setState({ apps: [...apps, installer] })

		store.getState().toggleFavorite(installer.id)
		store.getState().moveApp(installer.id, 'games')

		expect(store.getState().favoriteAppIds).toEqual([])
		expect(store.getState().categoryOverrides).toEqual({})
		expect(store.getState().categoryOverrideIdentities).toEqual({})
	})

	it('files an application into Installers & Docs and lets it back out', () => {
		const store = createAppStore(client())
		store.setState({ apps })
		store.getState().toggleFavorite('code')

		store.getState().moveApp('code', 'installers_docs')

		expect(store.getState().installerAppIds).toEqual(['code'])
		expect(store.getState().installerAppIdentities).toEqual(['code'])
		// An artifact is never a favorite, so filing one has to drop the star with it.
		expect(store.getState().favoriteAppIds).toEqual([])
		expect(store.getState().categoryOverrides).toEqual({})

		store.getState().moveApp('code', 'utilities')

		expect(store.getState().installerAppIds).toEqual([])
		expect(store.getState().installerAppIdentities).toEqual([])
		expect(store.getState().categoryOverrides).toEqual({
			code: 'utilities',
		})
	})

	// A stick added as a scan folder becomes a category the moment its first record arrives, and
	// the category is a real user category — persisted, placed first like any category the user
	// creates, renameable — rather than a row the grid would drop for naming an id it does not know.
	it('does not persist ineffective category or artifact moves for a drive-root app', async () => {
		const stick = app({
			id: 'stick',
			name: 'Tool',
			path: 'F:\\tool.exe',
			category: 'utilities',
			scanFolder: 'F:\\',
		})
		const store = createAppStore(
			client({
				getApps: vi.fn().mockResolvedValue({
					apps: [stick],
					hasCache: true,
					generation: 1,
				}),
			}),
			memoryStorage(),
		)
		await store.getState().initialize()
		store.getState().moveApp('stick', 'games')
		store.getState().moveApp('stick', 'installers_docs')
		expect(store.getState().categoryOverrides).toEqual({})
		expect(store.getState().categoryOverrideIdentities).toEqual({})
		expect(store.getState().installerAppIds).toEqual([])
		expect(store.getState().undoable).toBeNull()
	})

	it('creates a persisted drive category for records found under an added drive root', async () => {
		const stick = app({
			id: 'rufus',
			name: 'Rufus',
			path: 'F:\\Tools\\rufus.exe',
			category: 'utilities',
			sourceKind: 'portable',
			scanFolder: 'F:\\',
		})
		const values = new Map<string, string>()
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) =>
				void values.set(key, value),
		} as unknown as Storage
		const store = createAppStore(
			client({
				refreshApps: vi.fn().mockResolvedValue({
					apps: [...apps, stick],
					generation: 1,
				}),
			}),
			storage,
		)

		await store.getState().refresh()

		const category = store
			.getState()
			.categories.find(entry => entry.id === 'drive:f')
		expect(category).toMatchObject({ label: 'Disk F', builtIn: false })
		expect(category?.accent).toBeDefined()
		expect(store.getState().categoryOrder[0]).toBe('drive:f')
		expect(
			JSON.parse(values.get(PREFERENCES_KEY) ?? '{}').categories.some(
				(entry: { id: string }) => entry.id === 'drive:f',
			),
		).toBe(true)
	})

	it('keeps a renamed drive category through the next scan', async () => {
		const stick = app({
			id: 'rufus',
			name: 'Rufus',
			path: 'F:\\Tools\\rufus.exe',
			category: 'utilities',
			sourceKind: 'portable',
			scanFolder: 'F:\\',
		})
		const store = createAppStore(
			client({
				refreshApps: vi
					.fn()
					.mockResolvedValue({ apps: [stick], generation: 1 }),
			}),
		)
		await store.getState().refresh()
		store.getState().renameCategory('drive:f', 'Strelec')

		await store.getState().refresh()

		expect(
			store.getState().categories.filter(entry => entry.id === 'drive:f'),
		).toEqual([expect.objectContaining({ label: 'Strelec' })])
		expect(
			store.getState().categoryOrder.filter(entry => entry === 'drive:f'),
		).toHaveLength(1)
	})

	// The update that starts tracking volumes changes every stick record's identity while its
	// id stays put; the marks, the first-seen stamp and the renamed category all
	// have to come along, or the user loses them the first time they scan.
	it('carries marks, first-seen and the renamed drive category over the volume migration', async () => {
		const letterKeyed = app({
			id: 'rufus',
			name: 'Rufus',
			path: 'F:\\Tools\\rufus.exe',
			category: 'utilities',
			sourceKind: 'portable',
			scanFolder: 'F:\\',
			preferenceIdentity: 'identity:letter',
		})
		const volumeKeyed = {
			...letterKeyed,
			volumeId: '1a2b3c4d',
			preferenceIdentity: 'identity:volume',
		}
		const refreshApps = vi
			.fn()
			.mockResolvedValueOnce({ apps: [letterKeyed], generation: 1 })
			.mockResolvedValueOnce({ apps: [volumeKeyed], generation: 2 })
		const store = createAppStore(client({ refreshApps }), memoryStorage())
		await store.getState().refresh()
		store.getState().toggleFavorite('rufus')
		store.getState().renameCategory('drive:f', 'Strelec')
		const firstSeen = store.getState().firstSeenAt['identity:letter']

		await store.getState().refresh()

		const state = store.getState()
		expect(state.favoriteAppIds).toEqual(['rufus'])
		expect(state.favoriteAppIdentities).toContain('identity:volume')
		expect(state.firstSeenAt['identity:volume']).toBe(firstSeen)
		expect(
			state.categories.filter(entry => entry.id.startsWith('drive:')),
		).toEqual([
			expect.objectContaining({ id: 'drive:1a2b3c4d', label: 'Strelec' }),
		])
		expect(state.categoryOrder).toContain('drive:1a2b3c4d')
		expect(state.categoryOrder).not.toContain('drive:f')
	})

	it('keeps the favorite and the category when the stick comes back at another letter', async () => {
		const atF = app({
			id: 'target:f:\\tools\\rufus.exe',
			name: 'Rufus',
			path: 'F:\\Tools\\rufus.exe',
			category: 'utilities',
			sourceKind: 'portable',
			scanFolder: 'F:\\',
			volumeId: '1a2b3c4d',
			preferenceIdentity: 'identity:volume',
		})
		const atG = {
			...atF,
			id: 'target:g:\\tools\\rufus.exe',
			path: 'G:\\Tools\\rufus.exe',
			scanFolder: 'G:\\',
		}
		const refreshApps = vi
			.fn()
			.mockResolvedValueOnce({ apps: [atF], generation: 1 })
			.mockResolvedValueOnce({ apps: [atG], generation: 2 })
		const store = createAppStore(client({ refreshApps }), memoryStorage())
		await store.getState().refresh()
		store.getState().toggleFavorite(atF.id)

		await store.getState().refresh()

		const state = store.getState()
		expect(state.favoriteAppIds).toEqual([atG.id])
		expect(
			state.categories.filter(entry => entry.id.startsWith('drive:')),
		).toEqual([
			expect.objectContaining({ id: 'drive:1a2b3c4d', label: 'Disk G' }),
		])
		expect(selectVisibleApps(state).map(entry => entry.category)).toEqual([
			'drive:1a2b3c4d',
		])
	})

	it('prunes an absent generated drive without overwriting reconciled category marks', async () => {
		const before = app({
			id: 'target:old',
			name: 'Toolbox',
			path: 'C:\\Toolbox.exe',
			category: 'other',
			preferenceIdentity: 'identity:toolbox',
		})
		const after = { ...before, id: 'target:new' }
		const removedDrive = app({
			id: 'rufus',
			name: 'Rufus',
			path: 'F:\\Tools\\rufus.exe',
			category: 'utilities',
			sourceKind: 'portable',
			scanFolder: 'F:\\',
			volumeId: '1a2b3c4d',
		})
		const store = createAppStore(
			client({
				refreshApps: vi
					.fn()
					.mockResolvedValue({ apps: [after], generation: 2 }),
			}),
			memoryStorage(),
		)
		store.setState(state => ({
			apps: [before, removedDrive],
			categories: [
				...state.categories,
				{
					id: 'drive:1a2b3c4d',
					label: 'Disk F',
					builtIn: false,
				},
			],
			categoryOrder: ['drive:1a2b3c4d', ...state.categoryOrder],
			categoryOverrides: { 'target:old': 'utilities' },
			categoryOverrideIdentities: {
				'identity:toolbox': 'utilities',
			},
		}))

		await store.getState().refresh()

		expect(store.getState().categoryOverrides).toEqual({
			'target:new': 'utilities',
		})
		expect(
			store
				.getState()
				.categories.some(category => category.id === 'drive:1a2b3c4d'),
		).toBe(false)
	})

	it('persists a manual installer mark and reloads it', () => {
		const values = new Map<string, string>()
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) =>
				void values.set(key, value),
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		store.setState({ apps })

		store.getState().moveApp('code', 'installers_docs')

		expect(
			JSON.parse(values.get(PREFERENCES_KEY) ?? '{}').installerAppIds,
		).toEqual(['code'])
		expect(
			createAppStore(client(), storage).getState().installerAppIds,
		).toEqual(['code'])
	})

	it('stamps a newly discovered app and keeps a stamp the snapshot does not carry', async () => {
		const getApps = vi
			.fn()
			.mockResolvedValueOnce({ apps: [apps[0]], hasCache: true })
			.mockResolvedValueOnce({ apps: [apps[0], apps[1]], hasCache: true })
			.mockResolvedValueOnce({ apps: [apps[1]], hasCache: true })
		const store = createAppStore(client({ getApps }), memoryStorage())
		// A real clock resolves the three loads to the same millisecond, which would let a stamp
		// that is rewritten on every load pass as one that was kept.
		const clock = vi
			.spyOn(Date, 'now')
			.mockReturnValueOnce(1_000)
			.mockReturnValueOnce(2_000)
			.mockReturnValueOnce(3_000)
			.mockReturnValue(4_000)

		try {
			await store.getState().load()
			expect(store.getState().firstSeenAt).toEqual({ code: 1_000 })

			await store.getState().load()
			// The app that was already there keeps its first stamp, or nothing ever looks old.
			expect(store.getState().firstSeenAt).toEqual({
				code: 1_000,
				chrome: 2_000,
			})

			await store.getState().load()
			// A snapshot without an app is not evidence that the app is gone, and only a
			// completed scan prunes.
			expect(store.getState().firstSeenAt).toEqual({
				code: 1_000,
				chrome: 2_000,
			})
		} finally {
			clock.mockRestore()
		}
	})

	it('keeps the stamp when a delta brings back an app the startup snapshot lacked', async () => {
		const getApps = vi
			.fn()
			.mockResolvedValueOnce({
				apps: [apps[0], apps[1]],
				generation: 2,
				hasCache: true,
			})
			.mockResolvedValueOnce({
				apps: [apps[0]],
				generation: 3,
				hasCache: true,
			})
		const store = createAppStore(client({ getApps }), memoryStorage())
		const clock = vi
			.spyOn(Date, 'now')
			.mockReturnValueOnce(1_000)
			.mockReturnValue(9_000)

		try {
			await store.getState().load()
			await store.getState().load()
			store.getState().applyDelta({
				generation: 4,
				removedIds: [],
				summary: { added: 0, removed: 0, updated: 0 },
				upserted: [apps[1]],
			})

			// The startup order is load() over the cached snapshot and then the scan delta. A
			// stamp dropped by the snapshot came back as Date.now(), so every start moved long
			// installed apps into Recently added.
			expect(store.getState().firstSeenAt.chrome).toBe(1_000)
		} finally {
			clock.mockRestore()
		}
	})

	it('prunes stamps for apps a completed scan no longer reports', async () => {
		const refreshApps = vi
			.fn()
			.mockResolvedValueOnce({ apps: [apps[0], apps[1]], generation: 1 })
			.mockResolvedValueOnce({ apps: [apps[1]], generation: 2 })
		const store = createAppStore(client({ refreshApps }), memoryStorage())

		await store.getState().refresh()
		expect(Object.keys(store.getState().firstSeenAt).sort()).toEqual([
			'chrome',
			'code',
		])

		await store.getState().refresh()
		// The scan output is the catalog, so the map cannot grow without bound.
		expect(Object.keys(store.getState().firstSeenAt)).toEqual(['chrome'])
	})

	it('persists first-seen stamps and reads them back', async () => {
		const values = new Map<string, string>()
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) =>
				void values.set(key, value),
		} as unknown as Storage

		await createAppStore(client(), storage).getState().load()
		const stored = JSON.parse(values.get(PREFERENCES_KEY) ?? '{}')
			.firstSeenAt as Record<string, number>
		expect(Object.keys(stored).sort()).toEqual(['chrome', 'code', 'codex'])

		// Survives a restart: a stamp re-derived on every start would make the whole catalog
		// look brand new after each launch.
		expect(
			createAppStore(client(), storage).getState().firstSeenAt,
		).toEqual(stored)
	})

	it('keeps auxiliary tools out of the normal catalog and search', () => {
		const store = createAppStore(client())
		store.setState({
			apps: [
				...apps,
				app({
					id: 'iconv',
					name: 'iconv',
					path: String.raw`C:\Git\usr\bin\iconv.exe`,
					category: 'development',
					visibilityClass: 'auxiliary',
					visibilityScore: -30,
					visibilityReasons: ['product_component'],
				}),
			],
			query: 'iconv',
		})

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).not.toContain('iconv')
		expect(selectFilteredApps(store.getState())).toEqual([])
	})

	it('shows hidden auxiliary tools only in the Hidden view', () => {
		const tool = app({
			id: 'iconv',
			name: 'iconv',
			path: String.raw`C:\Git\usr\bin\iconv.exe`,
			category: 'development',
			visibilityClass: 'auxiliary',
		})
		const store = createAppStore(client())
		store.setState({
			apps: [tool],
			hiddenAppIds: [tool.id],
			activeView: 'auxiliary',
		})

		expect(selectVisibleApps(store.getState())).toEqual([])
		store.setState({ activeView: 'hidden' })
		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['iconv'])
	})

	// Favorites are keyed by canonicalIdentity, so a favorite survives a release that changes an
	// app's id (its id is a function of the dedup grouping, the identity is stable).
	it('keeps a favorite when the app id changes but its identity does not', async () => {
		const storage = localStorage
		storage.clear()
		const before = app({
			id: 'target:old',
			name: 'Editor',
			path: String.raw`C:\Editor.exe`,
			category: 'development',
			canonicalIdentity: 'identity:editor',
		})
		const store = createAppStore(
			client({
				getApps: vi
					.fn()
					.mockResolvedValue({ apps: [before], hasCache: true }),
			}),
			storage,
		)
		store.setState({ apps: [before] })
		store.getState().toggleFavorite('target:old')

		expect(
			JSON.parse(storage.getItem(PREFERENCES_KEY) ?? '{}')
				.favoriteAppIdentities,
		).toEqual(['identity:editor'])

		// A later release loads the same app under a different id.
		const after = { ...before, id: 'target:new' }
		const reopened = createAppStore(
			client({
				getApps: vi
					.fn()
					.mockResolvedValue({ apps: [after], hasCache: true }),
			}),
			storage,
		)
		await reopened.getState().load()

		expect(reopened.getState().favoriteAppIds).toEqual(['target:new'])
		expect(
			selectVisibleApps({
				...reopened.getState(),
				activeView: 'favorites',
			}).map(item => item.id),
		).toEqual(['target:new'])
	})

	it('keeps an app hidden across an id change', async () => {
		const storage = localStorage
		storage.clear()
		const before = app({
			id: 'target:old',
			name: 'Helper',
			path: String.raw`C:\Helper.exe`,
			category: 'development',
			canonicalIdentity: 'identity:helper',
		})
		const store = createAppStore(
			client({
				getApps: vi
					.fn()
					.mockResolvedValue({ apps: [before], hasCache: true }),
			}),
			storage,
		)
		store.setState({ apps: [before] })
		store.getState().hideApp('target:old')

		const after = { ...before, id: 'target:new' }
		const reopened = createAppStore(
			client({
				getApps: vi
					.fn()
					.mockResolvedValue({ apps: [after], hasCache: true }),
			}),
			storage,
		)
		await reopened.getState().load()

		expect(reopened.getState().hiddenAppIds).toEqual(['target:new'])
	})

	// A manual category override is keyed by canonicalIdentity, so it survives a Force full scan /
	// Reset cache / dedup change that renames the app id.
	it('keeps a manual category override when the app id changes but its identity does not', async () => {
		const storage = localStorage
		storage.clear()
		const before = app({
			id: 'target:old',
			name: 'Toolbox',
			path: String.raw`C:\Toolbox.exe`,
			category: 'other',
			canonicalIdentity: 'identity:toolbox',
		})
		const store = createAppStore(
			client({
				getApps: vi
					.fn()
					.mockResolvedValue({ apps: [before], hasCache: true }),
			}),
			storage,
		)
		store.setState({ apps: [before] })
		store.getState().moveApp('target:old', 'utilities')

		expect(
			JSON.parse(storage.getItem(PREFERENCES_KEY) ?? '{}')
				.categoryOverrideIdentities,
		).toEqual({ 'identity:toolbox': 'utilities' })

		// A rescan loads the same app under a different id; the override must still apply.
		const after = { ...before, id: 'target:new' }
		const reopened = createAppStore(
			client({
				getApps: vi
					.fn()
					.mockResolvedValue({ apps: [after], hasCache: true }),
			}),
			storage,
		)
		await reopened.getState().load()

		const categorized = selectVisibleApps({
			...reopened.getState(),
			activeView: 'all',
		})
		expect(
			categorized.find(item => item.id === 'target:new')?.category,
		).toBe('utilities')
	})

	it('migrates a v6 canonical collision only to the card named by its saved id', async () => {
		localStorage.setItem(
			PREFERENCES_KEY,
			JSON.stringify({
				version: 6,
				favoriteAppIds: ['cmd-shortcut'],
				favoriteAppIdentities: ['product:command-prompt'],
				hiddenAppIds: ['cmd-shortcut'],
				hiddenAppIdentities: ['product:command-prompt'],
				categoryOverrides: { 'cmd-shortcut': 'utilities' },
				categoryOverrideIdentities: {
					'product:command-prompt': 'utilities',
				},
			}),
		)
		const shortcut = app({
			id: 'cmd-shortcut',
			name: 'Command Prompt',
			path: String.raw`C:\Menu\Command Prompt.lnk`,
			category: 'system',
			canonicalIdentity: 'product:command-prompt',
			preferenceIdentity: 'preference:cmd-shortcut',
			launchKind: 'shortcut',
			sourceKind: 'start_menu',
		})
		const executable = app({
			id: 'cmd-executable',
			name: 'Command Prompt',
			path: String.raw`C:\Windows\System32\cmd.exe`,
			category: 'system',
			canonicalIdentity: 'product:command-prompt',
			preferenceIdentity: 'preference:cmd-executable',
		})
		const store = createAppStore(
			client({
				getApps: vi.fn().mockResolvedValue({
					apps: [shortcut, executable],
					hasCache: true,
				}),
			}),
			localStorage,
		)

		await store.getState().load()

		expect(store.getState().favoriteAppIds).toEqual(['cmd-shortcut'])
		expect(store.getState().hiddenAppIds).toEqual(['cmd-shortcut'])
		expect(store.getState().categoryOverrides).toEqual({
			'cmd-shortcut': 'utilities',
		})
		expect(store.getState().favoriteAppIdentities).toEqual([
			'preference:cmd-shortcut',
		])
	})

	it('keeps an ambiguous v6 canonical preference unresolved instead of fanning it out', async () => {
		localStorage.setItem(
			PREFERENCES_KEY,
			JSON.stringify({
				version: 6,
				favoriteAppIdentities: ['product:command-prompt'],
			}),
		)
		const collision = ['shortcut', 'executable'].map(role =>
			app({
				id: `cmd-${role}`,
				name: 'Command Prompt',
				path: `C:\\cmd-${role}.exe`,
				category: 'system',
				canonicalIdentity: 'product:command-prompt',
				preferenceIdentity: `preference:cmd-${role}`,
			}),
		)
		const store = createAppStore(
			client({
				getApps: vi.fn().mockResolvedValue({
					apps: collision,
					hasCache: true,
				}),
			}),
			localStorage,
		)

		await store.getState().load()

		expect(store.getState().favoriteAppIds).toEqual([])
		expect(
			JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}')
				.legacyCanonicalPreferences.favorite,
		).toEqual(['product:command-prompt'])
	})

	it('persists an auxiliary tool promoted by the user', () => {
		const storage = localStorage
		storage.clear()
		const store = createAppStore(client(), storage)
		store.setState({
			apps: [
				app({
					id: 'iconv',
					name: 'iconv',
					path: String.raw`C:\Git\usr\bin\iconv.exe`,
					category: 'development',
					visibilityClass: 'auxiliary',
				}),
			],
		})

		store.getState().promoteAuxiliary('iconv')

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['iconv'])
		expect(
			JSON.parse(storage.getItem(PREFERENCES_KEY) ?? '{}'),
		).toMatchObject({
			promotedAppIdentities: ['iconv'],
		})
	})

	// A refused write must reach the UI: the grid keeps showing the change either way, so
	// without this flag the user loses favorites and hidden apps with no explanation.
	it('flags preferences as unsaved when storage refuses the write', () => {
		const storage = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError')
			},
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		store.setState({
			apps: [
				app({
					id: 'editor',
					name: 'Editor',
					path: String.raw`C:\Editor.exe`,
					category: 'development',
				}),
			],
		})

		expect(store.getState().preferencesPersisted).toBe(true)

		store.getState().toggleFavorite('editor')

		expect(store.getState().preferencesPersisted).toBe(false)
		expect(store.getState().favoriteAppIds).toEqual(['editor'])
	})

	it('migrates a legacy promoted id and survives a launcher source change', async () => {
		localStorage.setItem(
			PREFERENCES_KEY,
			JSON.stringify({ promotedAppIds: ['old-launcher'] }),
		)
		const first = app({
			id: 'old-launcher',
			canonicalIdentity: 'identity:example',
			name: 'Example Tool',
			path: String.raw`C:\Example\Tool.exe`,
			category: 'utilities',
			visibilityClass: 'auxiliary',
		})
		const replacement = app({
			...first,
			id: 'new-shortcut',
			path: String.raw`C:\Menu\Example Tool.lnk`,
			launchKind: 'shortcut',
			sourceKind: 'start_menu',
		})
		const store = createAppStore(
			client({
				getApps: vi
					.fn()
					.mockResolvedValue({ apps: [first], hasCache: true }),
				refreshApps: vi
					.fn()
					.mockResolvedValue({ apps: [replacement], generation: 1 }),
			}),
			localStorage,
		)

		await store.getState().load()
		await store.getState().refresh()

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['new-shortcut'])
		// The identity carries the mark; the id set now follows the live card instead of keeping
		// the replaced one, so views that filter by id cannot drift away from the catalog.
		expect(
			JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}'),
		).toMatchObject({
			promotedAppIds: ['new-shortcut'],
			promotedAppIdentities: ['identity:example'],
		})
		expect(store.getState().promotedAppIds).toEqual(['new-shortcut'])
	})

	it('moves a promoted tool back to auxiliary and removes its favorite', () => {
		const tool = app({
			id: 'helper',
			canonicalIdentity: 'identity:helper',
			name: 'Helper',
			path: String.raw`C:\Tool\helper.exe`,
			category: 'utilities',
			visibilityClass: 'auxiliary',
		})
		const store = createAppStore(client())
		store.setState({ apps: [tool] })
		store.getState().promoteAuxiliary(tool.id)
		store.getState().toggleFavorite(tool.id)

		store.getState().demoteAuxiliary(tool.id)

		expect(selectVisibleApps(store.getState())).toEqual([])
		expect(store.getState().favoriteAppIds).not.toContain(tool.id)
		expect(store.getState().promotedAppIdentities).not.toContain(
			'identity:helper',
		)
	})

	it('refuses to favorite an auxiliary tool before user promotion', () => {
		const tool = app({
			id: 'helper',
			name: 'Helper',
			path: String.raw`C:\Tool\helper.exe`,
			category: 'utilities',
			visibilityClass: 'auxiliary',
		})
		const store = createAppStore(client())
		store.setState({ apps: [tool] })

		store.getState().toggleFavorite(tool.id)

		expect(store.getState().favoriteAppIds).toEqual([])
	})

	it('loads applications and clears loading state', async () => {
		const store = createAppStore(client())
		await store.getState().load()
		expect(store.getState().apps).toEqual(apps)
		expect(store.getState().isLoading).toBe(false)
	})

	it('marks an app launching and clears it on the ceiling timer', async () => {
		vi.useFakeTimers()
		try {
			const store = createAppStore(client())
			await store.getState().launch(apps[0])
			expect(store.getState().launchingIds).toContain('code')
			vi.advanceTimersByTime(12000)
			expect(store.getState().launchingIds).not.toContain('code')
		} finally {
			vi.useRealTimers()
		}
	})

	it('clears launching immediately when a launch fails', async () => {
		const store = createAppStore(
			client({ launchApp: vi.fn().mockRejectedValue(new Error('nope')) }),
		)
		await expect(store.getState().launch(apps[0])).rejects.toThrow()
		expect(store.getState().launchingIds).not.toContain('code')
	})

	it('clearLaunching is idempotent', () => {
		const store = createAppStore(client())
		store.getState().markLaunching('x')
		expect(store.getState().launchingIds).toEqual(['x'])
		store.getState().clearLaunching('x')
		store.getState().clearLaunching('x')
		expect(store.getState().launchingIds).toEqual([])
	})

	// The diagnostics panel used to be filled once, by the cache read at startup, so it always
	// showed the previous session's scan and never the one the user had just run.
	it('replaces the scan diagnostics when a scan reports new ones', async () => {
		const published: ((diagnostics: CatalogDiagnostics) => void)[] = []
		const api = client({
			onCatalogDiagnostics: vi.fn(async handler => {
				published.push(handler)
				return () => undefined
			}),
		})
		const store = createAppStore(api)
		const dispose = await store.getState().initialize()

		expect(published).toHaveLength(1)
		published[0]?.({
			completedAt: 2,
			durationMs: 40,
			mode: 'force',
			totalApps: 7,
			sourceCounts: { registry: 7 },
			added: 0,
			removed: 0,
			updated: 0,
			targetAvailability: {
				byReason: { 'target.present': 7 },
				keptByNewRule: 0,
			},
		})

		expect(store.getState().catalogDiagnostics?.mode).toBe('force')
		expect(
			store.getState().catalogDiagnostics?.targetAvailability?.byReason,
		).toEqual({ 'target.present': 7 })
		dispose()
	})

	// A source that has recovered must not read as failed again because the event from the
	// earlier, failed scan arrived after the one from the scan that fixed it.
	it('keeps the newest source health when diagnostics arrive out of order', async () => {
		const published: ((diagnostics: CatalogDiagnostics) => void)[] = []
		const api = client({
			onCatalogDiagnostics: vi.fn(async handler => {
				published.push(handler)
				return () => undefined
			}),
		})
		const store = createAppStore(api)
		const dispose = await store.getState().initialize()
		const report = (
			completedAt: number,
			state: 'fresh' | 'stale',
		): CatalogDiagnostics => ({
			completedAt,
			durationMs: 40,
			mode: 'refresh',
			totalApps: 7,
			sourceCounts: { registry: 7 },
			added: 0,
			removed: 0,
			updated: 0,
			sources: [
				{
					key: 'start-menu',
					state,
					lastAttemptAt: completedAt,
					lastSuccessAt: state === 'fresh' ? completedAt : 1,
					consecutiveFailures: state === 'fresh' ? 0 : 1,
					lastDurationMs: 5,
					lastError: state === 'fresh' ? null : 'provider_failed',
					recordCount: 7,
				},
			],
		})

		published[0]?.(report(10, 'stale'))
		published[0]?.(report(20, 'fresh'))
		published[0]?.(report(15, 'stale'))

		expect(store.getState().catalogDiagnostics?.completedAt).toBe(20)
		expect(store.getState().catalogDiagnostics?.sources?.[0]?.state).toBe(
			'fresh',
		)
		dispose()
	})

	it('reuses an in-flight initialization so dev StrictMode does not start two scans', async () => {
		const api = client({
			startBackgroundSync: vi.fn().mockResolvedValue(undefined),
			onCatalogDelta: vi.fn().mockResolvedValue(() => undefined),
			onCatalogPatches: vi.fn().mockResolvedValue(() => undefined),
			onCatalogDiagnostics: vi.fn().mockResolvedValue(() => undefined),
		})
		const store = createAppStore(api)

		const [firstDispose, secondDispose] = await Promise.all([
			store.getState().initialize(),
			store.getState().initialize(),
		])

		expect(api.getApps).toHaveBeenCalledOnce()
		expect(api.startBackgroundSync).toHaveBeenCalledOnce()
		expect(api.onScanProgress).toHaveBeenCalledOnce()
		firstDispose()
		expect(api.onScanProgress).toHaveBeenCalledOnce()
		secondDispose()
	})

	it('cleans failed background startup and retries shared initialization', async () => {
		const disposeListener = vi.fn()
		const api = client({
			onScanProgress: vi.fn().mockResolvedValue(disposeListener),
			startBackgroundSync: vi
				.fn()
				.mockRejectedValueOnce(new Error('background failed'))
				.mockResolvedValue(undefined),
		})
		const store = createAppStore(api)
		const results = await Promise.allSettled([
			store.getState().initialize(),
			store.getState().initialize(),
		])
		expect(results.map(result => result.status)).toEqual([
			'rejected',
			'rejected',
		])
		expect(disposeListener).toHaveBeenCalledOnce()
		const dispose = await store.getState().initialize()
		expect(api.startBackgroundSync).toHaveBeenCalledTimes(2)
		dispose()
		dispose()
		expect(disposeListener).toHaveBeenCalledTimes(2)
	})

	it('does not let a released owner dispose a newer initialization', async () => {
		const stop = vi.fn()
		const store = createAppStore(
			client({ onScanProgress: vi.fn().mockResolvedValue(stop) }),
		)
		const first = await store.getState().initialize()
		first()
		const second = await store.getState().initialize()
		first()
		expect(stop).toHaveBeenCalledOnce()
		second()
		expect(stop).toHaveBeenCalledTimes(2)
	})

	it('detaches remaining listeners when one teardown throws', async () => {
		const stop = vi.fn()
		const store = createAppStore(
			client({
				onCatalogDelta: vi.fn().mockResolvedValue(() => {
					throw new Error('dispose failed')
				}),
				onScanProgress: vi.fn().mockResolvedValue(stop),
			}),
		)
		const dispose = await store.getState().initialize()
		expect(() => dispose()).not.toThrow()
		expect(stop).toHaveBeenCalledOnce()
	})

	// Registration used to be a bare sequence of awaits: a rejection partway through left every
	// earlier listener attached with nothing owning its teardown, and the rejected promise was
	// cached, so the app could never recover from a transient bridge failure.
	it('detaches earlier listeners when a later subscription fails', async () => {
		const disposeDelta = vi.fn()
		const disposePatches = vi.fn()
		const api = client({
			onCatalogDelta: vi.fn().mockResolvedValue(disposeDelta),
			onCatalogPatches: vi.fn().mockResolvedValue(disposePatches),
			onCatalogDiagnostics: vi
				.fn()
				.mockRejectedValue(new Error('bridge unavailable')),
		})
		const store = createAppStore(api)

		await expect(store.getState().initialize()).rejects.toThrow(
			'bridge unavailable',
		)

		expect(disposeDelta).toHaveBeenCalledOnce()
		expect(disposePatches).toHaveBeenCalledOnce()
		expect(api.onScanProgress).not.toHaveBeenCalled()
	})

	it('detaches every earlier listener when the last subscription fails', async () => {
		const disposers = [vi.fn(), vi.fn(), vi.fn(), vi.fn()]
		const api = client({
			onCatalogDelta: vi.fn().mockResolvedValue(disposers[0]),
			onCatalogPatches: vi.fn().mockResolvedValue(disposers[1]),
			onCatalogDiagnostics: vi.fn().mockResolvedValue(disposers[2]),
			onScanProgress: vi.fn().mockResolvedValue(disposers[3]),
			onLaunchStatus: vi
				.fn()
				.mockRejectedValue(new Error('late failure')),
		})
		const store = createAppStore(api)

		await expect(store.getState().initialize()).rejects.toThrow(
			'late failure',
		)

		for (const dispose of disposers) expect(dispose).toHaveBeenCalledOnce()
		// No catalog load ran, so the failure cannot be mistaken for an empty catalog.
		expect(api.getApps).not.toHaveBeenCalled()
	})

	// The initial state is `isLoading: true` and only `load()` clears it. Rejecting before the
	// load left the skeleton grid on screen forever, with no way back except a restart. The
	// rejection still owns the message, so `error` stays empty and only one notice is shown.
	it('leaves the loading state when subscription registration fails', async () => {
		const api = client({
			onScanProgress: vi
				.fn()
				.mockRejectedValue(new Error('bridge unavailable')),
		})
		const store = createAppStore(api)

		await expect(store.getState().initialize()).rejects.toThrow(
			'bridge unavailable',
		)

		expect(store.getState().isLoading).toBe(false)
		expect(store.getState().error).toBeNull()
		expect(api.getApps).not.toHaveBeenCalled()
	})

	it('retries initialization after a failed subscription instead of caching the rejection', async () => {
		const onCatalogDiagnostics = vi
			.fn()
			.mockRejectedValueOnce(new Error('bridge unavailable'))
			.mockResolvedValue(() => undefined)
		const api = client({
			onCatalogDelta: vi.fn().mockResolvedValue(() => undefined),
			onCatalogPatches: vi.fn().mockResolvedValue(() => undefined),
			onCatalogDiagnostics,
		})
		const store = createAppStore(api)

		await expect(store.getState().initialize()).rejects.toThrow(
			'bridge unavailable',
		)
		const dispose = await store.getState().initialize()

		expect(onCatalogDiagnostics).toHaveBeenCalledTimes(2)
		expect(api.getApps).toHaveBeenCalledOnce()
		expect(store.getState().apps).toHaveLength(apps.length)
		dispose()
	})

	it('keeps one app per id when cached and updated data repeats entries', async () => {
		const duplicate = { ...apps[0] }
		const store = createAppStore(
			client({
				getApps: vi.fn().mockResolvedValue({
					apps: [apps[0], duplicate, apps[1]],
					hasCache: true,
				}),
				refreshApps: vi.fn().mockResolvedValue({
					apps: [apps[0], duplicate, apps[1]],
					generation: 1,
				}),
			}),
		)

		await store.getState().load()
		await store.getState().refresh()
		store.getState().applyDelta({
			generation: 1,
			upserted: [apps[0], duplicate],
			removedIds: [],
			summary: { added: 0, removed: 0, updated: 0 },
		})

		expect(store.getState().apps.map(app => app.id)).toEqual([
			'code',
			'chrome',
		])
	})

	it('collapses stale shortcut and executable duplicates by canonical id', () => {
		const canonicalId = 'target:d:\\games\\battle.net\\battle.net.exe'
		const shortcut = app({
			id: canonicalId,
			name: 'Battle.net',
			path: String.raw`C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Battle.net\Battle.net.lnk`,
			category: 'games',
			launchKind: 'shortcut',
			sourceKind: 'start_menu',
		})
		const executable = app({
			id: canonicalId,
			name: 'Battle.net',
			path: String.raw`D:\Games\Battle.net\Battle.net.exe`,
			category: 'games',
			launchKind: 'executable',
			sourceKind: 'portable',
		})
		const store = createAppStore(client())
		store.setState({ apps: [executable, shortcut] })

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual([canonicalId])
	})

	it('does not merge product-family siblings in the UI', () => {
		const shortcut = app({
			id: 's',
			name: 'Acme',
			path: String.raw`C:\Menu\Acme.lnk`,
			category: 'other',
			launchKind: 'shortcut',
		})
		const executable = app({
			id: 'e',
			name: 'Acme Launcher',
			path: String.raw`C:\Apps\Acme\Acme.exe`,
			category: 'other',
		})
		const sibling = app({
			id: 'x',
			name: 'Acme Launcher',
			path: String.raw`D:\Copy\Acme.exe`,
			category: 'other',
		})
		const store = createAppStore(client())
		store.setState({ apps: [shortcut, executable, sibling] })

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['s', 'e', 'x'])
	})

	it('keeps unresolved launcher executable when only names imply a duplicate', () => {
		const shortcut = app({
			id: 'wow-lnk',
			name: 'World of Warcraft',
			path: String.raw`C:\ProgramData\Microsoft\Windows\Start Menu\Programs\World of Warcraft\World of Warcraft.lnk`,
			category: 'games',
			launchKind: 'shortcut',
			sourceKind: 'start_menu',
		})
		const executable = app({
			id: 'wow-launcher',
			name: 'World of Warcraft Launcher',
			path: String.raw`D:\Games\World of Warcraft\World of Warcraft Launcher.exe`,
			category: 'games',
			launchKind: 'executable',
			sourceKind: 'portable',
		})
		const store = createAppStore(client())
		store.setState({ apps: [executable, shortcut] })

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['wow-launcher', 'wow-lnk'])
	})

	it('keeps unresolved Steam and executable entries when ids differ', () => {
		const steam = app({
			id: 'hearthstone-steam',
			name: 'Hearthstone',
			path: 'steam://rungameid/123',
			category: 'games',
			sourceKind: 'steam',
		})
		const executable = app({
			id: 'hearthstone-exe',
			name: 'Hearthstone',
			path: String.raw`D:\Games\Hearthstone\Hearthstone.exe`,
			category: 'games',
			sourceKind: 'portable',
		})
		const store = createAppStore(client())
		store.setState({ apps: [executable, steam] })

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['hearthstone-exe', 'hearthstone-steam'])
	})

	it('keeps unresolved TablePlus shortcut and versioned executable duplicates', () => {
		const shortcut = app({
			id: 'tableplus-lnk',
			name: 'TablePlus',
			path: String.raw`C:\ProgramData\Microsoft\Windows\Start Menu\Programs\TablePlus\TablePlus.lnk`,
			category: 'other',
			launchKind: 'shortcut',
			sourceKind: 'start_menu',
			publisher: 'TablePlus Inc',
			version: '6.4.0.0',
		})
		const executable = app({
			id: 'tableplus-exe',
			name: 'TablePlus 6.4.0',
			path: String.raw`D:\Tools\TablePlus\TablePlus.exe`,
			category: 'other',
			launchKind: 'executable',
			sourceKind: 'registry',
			publisher: 'TablePlus, Inc',
			version: '6.4.0',
		})
		const store = createAppStore(client())
		store.setState({ apps: [executable, shortcut] })

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['tableplus-exe', 'tableplus-lnk'])
	})

	it('keeps unresolved shortcut and executable duplicates when ids differ', () => {
		const shortcut = app({
			id: 'assistant-lnk',
			name: 'Assistant',
			path: String.raw`C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Assistant\Assistant.lnk`,
			category: 'other',
			launchKind: 'shortcut',
			sourceKind: 'start_menu',
			publisher: 'Vendor LLC',
			version: '5.6.2408.0',
		})
		const executable = app({
			id: 'assistant-exe',
			name: 'Assistant 5.6.2.1',
			path: String.raw`D:\Tools\Assistant\AstUtil.exe`,
			category: 'other',
			launchKind: 'executable',
			sourceKind: 'registry',
			publisher: 'Vendor',
			version: '5.6.2403.1202',
		})
		const store = createAppStore(client())
		store.setState({ apps: [executable, shortcut] })

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['assistant-exe', 'assistant-lnk'])
	})

	it('keeps same-name apps when publishers conflict', () => {
		const first = app({
			id: 'app-a',
			name: 'Assistant',
			path: String.raw`D:\A\Assistant.exe`,
			category: 'ai',
			publisher: 'Vendor A',
		})
		const second = app({
			id: 'app-b',
			name: 'Assistant',
			path: String.raw`D:\B\Assistant.exe`,
			category: 'ai',
			publisher: 'Vendor B',
		})
		const store = createAppStore(client())
		store.setState({ apps: [first, second] })

		expect(
			selectVisibleApps(store.getState()).map(item => item.id),
		).toEqual(['app-a', 'app-b'])
	})

	it('filters applications case-insensitively', () => {
		const store = createAppStore(client())
		store.setState({ apps, query: 'CHROME' })
		expect(selectFilteredApps(store.getState())).toEqual([apps[1]])
	})

	it('resets catalog cache through the client and replaces apps', async () => {
		const api = client()
		const store = createAppStore(api)

		await store.getState().resetCatalogCache()

		expect(api.resetCatalogCache).toHaveBeenCalledOnce()
		expect(store.getState().apps).toEqual([apps[2]])
		expect(store.getState().hasCache).toBe(true)
	})

	it('keeps the visible catalog when a cache reset fails', async () => {
		const store = createAppStore(
			client({
				resetCatalogCache: vi
					.fn()
					.mockRejectedValue(new Error('reset denied')),
			}),
		)
		store.setState({ apps, hasCache: true })

		await expect(store.getState().resetCatalogCache()).rejects.toThrow(
			'reset denied',
		)

		expect(store.getState().apps).toEqual(apps)
		expect(store.getState().isRefreshing).toBe(false)
	})

	it('requests priority hydration for visible icon ids', async () => {
		const api = client()
		const store = createAppStore(api)

		await store.getState().hydrateVisibleIcons(['code', 'chrome'])

		expect(api.hydrateVisibleIcons).toHaveBeenCalledWith(['code', 'chrome'])
	})

	it('batches clear and repair hydration for catalogs above the IPC limit', async () => {
		const catalog = Array.from({ length: 129 }, (_, index) =>
			app({
				id: `app-${index}`,
				name: `App ${index}`,
				path: `C:\\Apps\\app-${index}.exe`,
				category: 'other',
			}),
		)
		const hydrateVisibleIcons = vi.fn().mockResolvedValue(undefined)
		const api = client({
			clearIconCache: vi.fn().mockResolvedValue(undefined),
			hydrateVisibleIcons,
		})
		const store = createAppStore(api)
		store.setState({ apps: catalog })

		await store.getState().clearIconCache()

		expect(hydrateVisibleIcons).toHaveBeenNthCalledWith(
			1,
			catalog.slice(0, 128).map(item => item.id),
		)
		expect(hydrateVisibleIcons).toHaveBeenNthCalledWith(2, ['app-128'])

		hydrateVisibleIcons.mockClear()
		await store.getState().repairMissingIcons()

		expect(hydrateVisibleIcons).toHaveBeenNthCalledWith(
			1,
			catalog.slice(0, 128).map(item => item.id),
		)
		expect(hydrateVisibleIcons).toHaveBeenNthCalledWith(2, ['app-128'])
	})

	it('continues best-effort hydration after one batch fails', async () => {
		const catalog = Array.from({ length: 129 }, (_, index) =>
			app({
				id: `app-${index}`,
				name: `App ${index}`,
				path: `C:\\Apps\\app-${index}.exe`,
				category: 'other',
			}),
		)
		const hydrateVisibleIcons = vi
			.fn()
			.mockRejectedValueOnce(new Error('first batch failed'))
			.mockResolvedValue(undefined)
		const store = createAppStore(client({ hydrateVisibleIcons }))
		store.setState({ apps: catalog })

		await store.getState().repairMissingIcons()

		expect(hydrateVisibleIcons).toHaveBeenCalledTimes(2)
		expect(hydrateVisibleIcons).toHaveBeenLastCalledWith(['app-128'])
	})

	// Marks are stored twice: by catalog id and by durable identity. The id is derived from the
	// path, so a reinstall, a moved shortcut or a source change gives the same application a new
	// one. Reconciling only in `load()` meant every rescan — including the background scan the
	// watcher starts whenever anything is installed — silently unfavourited and unhid entries.
	describe('marks survive a rescan that changes catalog ids', () => {
		const moved = app({
			id: 'code-moved',
			name: 'Visual Studio Code',
			path: 'D:\\Code\\Code.exe',
			category: 'development',
			preferenceIdentity: 'code-identity',
		})
		const original = app({
			id: 'code',
			name: 'Visual Studio Code',
			path: 'C:\\Code.exe',
			category: 'development',
			preferenceIdentity: 'code-identity',
		})

		function movedStore() {
			const values = new Map<string, string>()
			const storage = {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) =>
					void values.set(key, value),
				removeItem: (key: string) => void values.delete(key),
			} as unknown as Storage
			return createAppStore(
				client({
					getApps: vi.fn().mockResolvedValue({
						apps: [original],
						hasCache: true,
					}),
					refreshApps: vi
						.fn()
						.mockResolvedValue({ apps: [moved], generation: 1 }),
				}),
				storage,
			)
		}

		it('keeps a favorite in the Favorites view after a refresh', async () => {
			const store = movedStore()
			await store.getState().load()
			store.getState().toggleFavorite('code')

			await store.getState().refresh()

			store.setState({ activeView: 'favorites' })
			expect(
				selectVisibleApps(store.getState()).map(entry => entry.id),
			).toEqual(['code-moved'])
		})

		it('keeps a hidden application hidden after a refresh', async () => {
			const store = movedStore()
			await store.getState().load()
			store.getState().hideApp('code')

			await store.getState().refresh()

			store.setState({ activeView: 'all' })
			expect(selectVisibleApps(store.getState())).toEqual([])
		})

		it('keeps a favorite visible after a catalog delta replaces its id', async () => {
			const store = movedStore()
			await store.getState().load()
			store.getState().toggleFavorite('code')

			store.getState().applyDelta({
				generation: 1,
				upserted: [moved],
				removedIds: ['code'],
				summary: { added: 1, removed: 1, updated: 0 },
			})

			store.setState({ activeView: 'favorites' })
			expect(
				selectVisibleApps(store.getState()).map(entry => entry.id),
			).toEqual(['code-moved'])
		})

		it('shows imported favorites against the local catalog without a restart', async () => {
			const store = movedStore()
			await store.getState().load()

			expect(
				store.getState().importPreferences(
					JSON.stringify({
						version: 15,
						favoriteAppIdentities: ['code-identity'],
						favoriteAppIds: ['id-from-another-machine'],
					}),
				),
			).toEqual({ ok: true })

			store.setState({ activeView: 'favorites' })
			expect(
				selectVisibleApps(store.getState()).map(entry => entry.id),
			).toEqual(['code'])
		})
	})

	it('searches publisher and description', () => {
		const store = createAppStore(client())
		store.setState({ apps, query: 'openai' })
		expect(
			selectFilteredApps(store.getState()).map(item => item.id),
		).toEqual(['codex'])
		store.setState({ query: 'microsoft' })
		expect(
			selectFilteredApps(store.getState()).map(item => item.id),
		).toEqual(['code'])
	})

	it('replaces applications after refresh', async () => {
		const store = createAppStore(client())
		await store.getState().refresh()
		expect(store.getState().apps).toEqual(apps.slice().reverse())
		expect(store.getState().isRefreshing).toBe(false)
	})

	it('does not publish scan cancellation through the global error state', async () => {
		const cancellation = new AppClientError(
			'SCAN_CANCELLED',
			'Application scan cancelled.',
		)
		const store = createAppStore(
			client({
				refreshApps: vi.fn().mockRejectedValue(cancellation),
			}),
		)

		await expect(store.getState().refresh()).rejects.toBe(cancellation)

		expect(store.getState().error).toBeNull()
	})

	// An action reports its failure by rejecting, and its caller owns the message. `error` is the
	// background channel for work nobody awaits; writing both produced two toasts for one failure.
	it('rejects a failed launch without also writing the background error state', async () => {
		const store = createAppStore(
			client({
				launchApp: vi
					.fn()
					.mockRejectedValue(new Error('Access denied')),
			}),
		)
		await expect(store.getState().launch(apps[0])).rejects.toThrow(
			'Access denied',
		)
		expect(store.getState().error).toBeNull()
		expect(store.getState().launchingIds).toEqual([])
	})

	it('rejects a failed refresh without also writing the background error state', async () => {
		const store = createAppStore(
			client({
				refreshApps: vi
					.fn()
					.mockRejectedValue(new Error('scan failed')),
			}),
		)
		await expect(store.getState().refresh()).rejects.toThrow('scan failed')
		expect(store.getState().error).toBeNull()
		expect(store.getState().isRefreshing).toBe(false)
	})

	// A failed catalog load has no caller waiting on it, so it must still reach the user.
	it('still surfaces a background load failure through the error state', async () => {
		const store = createAppStore(
			client({
				getApps: vi
					.fn()
					.mockRejectedValue(new Error('cache unreadable')),
			}),
		)

		await store.getState().load()

		expect(store.getState().error).toBe(
			'The operation could not be completed. Try again.',
		)
		expect(store.getState().isLoading).toBe(false)
	})

	it('toggles favorites, persists them, and filters the favorites view', () => {
		const storage = {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		store.setState({ apps })
		store.getState().toggleFavorite('code')
		store.getState().setActiveView('favorites')
		expect(selectVisibleApps(store.getState())).toEqual([apps[0]])
		expect(storage.setItem).toHaveBeenLastCalledWith(
			PREFERENCES_KEY,
			expect.stringContaining('"favoriteAppIds":["code"]'),
		)
	})

	it('hides and restores an app without losing its category or favorite', () => {
		const storage = {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		store.setState({ apps })
		store.getState().toggleFavorite('code')
		store.getState().moveApp('code', 'ai')
		store.getState().hideApp('code')
		expect(
			selectVisibleApps(store.getState()).map(app => app.id),
		).not.toContain('code')
		store.getState().setActiveView('hidden')
		expect(selectVisibleApps(store.getState()).map(app => app.id)).toEqual([
			'code',
		])
		store.getState().restoreApp('code')
		expect(store.getState().categoryOverrides.code).toBe('ai')
		expect(store.getState().favoriteAppIds).toContain('code')
	})

	it('reorders categories and persists the order', () => {
		const storage = {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		store.getState().reorderCategory('browsers', 'games')
		expect(store.getState().categoryOrder.slice(0, 2)).toEqual([
			'browsers',
			'games',
		])
		expect(storage.setItem).toHaveBeenCalled()
	})

	it('toggles collapsed categories through the preferences document', () => {
		const storage = {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		store.getState().toggleCategory('development')
		expect(store.getState().collapsedCategories).toContain('development')
		expect(storage.setItem).toHaveBeenCalledWith(
			PREFERENCES_KEY,
			expect.any(String),
		)
	})

	it('applies and persists a manual category override', () => {
		const storage = {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
		} as unknown as Storage
		const store = createAppStore(client(), storage)
		store.setState({ apps })
		store.getState().moveApp('code', 'ai')
		expect(
			selectFilteredApps(store.getState()).find(
				item => item.id === 'code',
			)?.category,
		).toBe('ai')
		expect(storage.setItem).toHaveBeenLastCalledWith(
			PREFERENCES_KEY,
			expect.stringContaining('"code":"ai"'),
		)
	})

	it('creates, renames, and deletes a custom category while moving apps to Other', () => {
		const storage = {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
		} as unknown as Storage
		const store = createAppStore(client(), storage, () => 'custom:work')
		expect(store.getState().createCategory('Work')).toEqual({
			ok: true,
			id: 'custom:work',
		})
		expect(store.getState().categoryOrder[0]).toBe('custom:work')
		expect(
			store.getState().categories[store.getState().categories.length - 1],
		).toMatchObject({
			id: 'custom:work',
			label: 'Work',
			builtIn: false,
			accent: expect.any(String),
		})
		expect(storage.setItem).toHaveBeenLastCalledWith(
			PREFERENCES_KEY,
			expect.stringContaining('"accent"'),
		)
		store.getState().moveApp('code', 'custom:work')
		expect(
			store.getState().renameCategory('custom:work', 'Projects'),
		).toEqual({ ok: true })
		expect(store.getState().deleteCategory('custom:work')).toEqual({
			ok: true,
		})
		expect(store.getState().categoryOrder).not.toContain('custom:work')
	})

	// Rewriting the override to "other" threw away the classifier's own answer, so an application
	// could never find its way back after its custom category was removed.
	it('returns applications to their detected category when a custom one is deleted', () => {
		const store = createAppStore(client(), undefined, () => 'custom:work')
		store.setState({ apps })
		store.getState().createCategory('Work')
		store.getState().moveApp('code', 'custom:work')
		expect(selectVisibleApps(store.getState())[0]).toMatchObject({
			id: 'code',
			category: 'custom:work',
		})

		expect(store.getState().deleteCategory('custom:work')).toEqual({
			ok: true,
		})

		expect(store.getState().categoryOverrides.code).toBeUndefined()
		expect(
			selectVisibleApps(store.getState()).find(
				entry => entry.id === 'code',
			)?.category,
		).toBe('development')
	})
})
