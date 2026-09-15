import { describe, expect, it, vi } from 'vitest'
import { PREFERENCES_KEY } from '../../../../src/app/store/preferences'
import { createAppStore } from '../../../../src/app/store/appStore'
import {
	MAX_SCENARIO_ENTRIES,
	MAX_SCENARIOS,
	resolveScenarioApps,
} from '../../../../src/entities/scenario'
import type { AppInfo, AppsClient } from '../../../../src/entities/app'

function client(): AppsClient {
	return {
		getApps: vi.fn().mockResolvedValue({ apps: [], hasCache: true }),
		refreshApps: vi.fn().mockResolvedValue({ apps: [], generation: 1 }),
		cancelScan: vi.fn().mockResolvedValue(undefined),
		launchApp: vi.fn().mockResolvedValue(undefined),
		closeApps: vi.fn().mockResolvedValue({
			closed: 0,
			notRunning: 0,
			unavailable: 0,
			failed: 0,
		}),
		getAppDetails: vi.fn(),
		openAppFolder: vi.fn().mockResolvedValue(undefined),
		onScanProgress: vi.fn().mockResolvedValue(() => undefined),
	}
}

function memoryStorage() {
	const values = new Map<string, string>()
	return {
		values,
		storage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) =>
				void values.set(key, value),
		} as unknown as Storage,
	}
}

let counter = 0
const idFactory = () => `scenario-${(counter += 1)}`

describe('scenario actions', () => {
	it('reconciles imported identities but leaves ambiguous name matches unresolved', async () => {
		const transport = client()
		const apps = [
			{
				id: 'editor',
				name: 'Editor',
				preferenceIdentity: 'stable:editor',
				canonicalIdentity: 'old:editor',
				path: 'C:\\editor.exe',
			},
			{ id: 'one', name: 'Shared', path: 'C:\\one.exe' },
			{ id: 'two', name: 'Shared', path: 'C:\\two.exe' },
		].map(value => ({
			category: 'other',
			launchKind: 'executable',
			sourceKind: 'portable',
			iconBase64: null,
			platformKind: null,
			description: null,
			version: null,
			publisher: null,
			installLocation: null,
			canUninstall: false,
			...value,
		})) as AppInfo[]
		transport.getApps = vi
			.fn()
			.mockResolvedValue({ apps, hasCache: true, generation: 1 })
		const store = createAppStore(
			transport,
			memoryStorage().storage,
			idFactory,
		)
		await store.getState().initialize()
		const source = JSON.stringify({
			version: 22,
			scenarios: [
				{
					id: 'source',
					name: 'Imported',
					launchIdentities: ['old:editor', 'missing'],
					launchAppSnapshots: {
						missing: { name: 'Shared', iconBase64: null },
					},
				},
			],
		})
		expect(
			store
				.getState()
				.importSelectedScenarios(source, [
					{ sourceId: 'source', replaceId: null },
				]).ok,
		).toBe(true)
		expect(store.getState().scenarios[0].launchIdentities).toEqual([
			'old:editor',
			'missing',
		])
		const saved = store.getState().scenarios[0]
		const resolved = resolveScenarioApps(
			saved.launchIdentities,
			store.getState().apps,
			saved.launchAppSnapshots,
		)
		expect(resolved.apps.map(item => item.id)).toEqual(['editor'])
		expect(resolved.unavailable).toHaveLength(1)
	})
	it('imports only selected scenarios without changing preferences or launching apps', () => {
		const transport = client()
		const { storage } = memoryStorage()
		const store = createAppStore(transport, storage, idFactory)
		store.getState().createScenario('Local')
		store
			.getState()
			.toggleFavoriteScenario(store.getState().scenarios[0].id)
		const before = store.getState()
		const source = JSON.stringify({
			version: 22,
			favoriteAppIds: ['foreign'],
			favoriteScenarioIds: ['source'],
			scenarios: [
				{
					id: 'source',
					name: 'Local',
					closeIdentities: ['missing'],
					forceClose: false,
				},
				{ id: 'skip', name: 'Skip' },
			],
		})
		expect(
			store
				.getState()
				.importSelectedScenarios(source, [
					{ sourceId: 'source', replaceId: null },
				]),
		).toEqual({ ok: true })
		expect(store.getState().scenarios.map(item => item.name)).toEqual([
			'Local',
			'Local (2)',
		])
		expect(store.getState().scenarios[1].closeIdentities).toEqual([
			'missing',
		])
		expect(store.getState().scenarios[1].forceClose).toBe(false)
		expect(store.getState().favoriteScenarioIds).toBe(
			before.favoriteScenarioIds,
		)
		expect(store.getState().favoriteAppIds).toBe(before.favoriteAppIds)
		expect(store.getState().categories).toBe(before.categories)
		expect(transport.launchApp).not.toHaveBeenCalled()
		expect(transport.closeApps).not.toHaveBeenCalled()
		expect(createAppStore(client(), storage).getState().scenarios).toEqual(
			store.getState().scenarios,
		)
		expect(store.getState().undo().ok).toBe(true)
		expect(store.getState().scenarios).toEqual(before.scenarios)
	})

	it('keeps the previous scenarios and undo entry if selected import cannot be saved', () => {
		const { storage } = memoryStorage()
		const store = createAppStore(client(), storage, idFactory)
		store.getState().createScenario('Local')
		const before = store.getState()
		storage.setItem = () => {
			throw new Error('denied')
		}
		const source = JSON.stringify({
			version: 22,
			scenarios: [{ id: 'source', name: 'Imported' }],
		})
		expect(
			store
				.getState()
				.importSelectedScenarios(source, [
					{ sourceId: 'source', replaceId: before.scenarios[0].id },
				]).ok,
		).toBe(false)
		expect(store.getState().scenarios).toBe(before.scenarios)
		expect(store.getState().undoable).toBe(before.undoable)
	})

	it('rejects invalid, oversized and future backups and does not apply a cancelled selection', () => {
		const { storage, values } = memoryStorage()
		const store = createAppStore(client(), storage, idFactory)
		for (const source of [
			'{',
			JSON.stringify({ version: 99 }),
			' '.repeat(1_048_577),
		])
			expect(store.getState().inspectScenarioImport(source).ok).toBe(
				false,
			)
		const source = JSON.stringify({
			version: 22,
			scenarios: [{ id: 'source', name: 'Imported' }],
		})
		expect(store.getState().inspectScenarioImport(source).ok).toBe(true)
		expect(store.getState().scenarios).toEqual([])
		expect(store.getState().importSelectedScenarios(source, []).ok).toBe(
			false,
		)
		values.set(PREFERENCES_KEY, JSON.stringify({ version: 99 }))
		expect(
			store
				.getState()
				.importSelectedScenarios(source, [
					{ sourceId: 'source', replaceId: null },
				]).ok,
		).toBe(false)
	})
	it('defaults new scenarios to graceful close and persists an undoable explicit force choice', () => {
		const { storage } = memoryStorage()
		const store = createAppStore(client(), storage, idFactory)
		store.getState().createScenario('Work')
		const item = store.getState().scenarios[0]
		expect(item.forceClose).toBe(false)
		expect(store.getState().setScenarioForceClose(item.id, true)).toBe(true)
		expect(
			createAppStore(client(), storage).getState().scenarios[0]
				.forceClose,
		).toBe(true)
		expect(store.getState().undo().ok).toBe(true)
		expect(store.getState().scenarios[0].forceClose).toBe(false)
	})

	it('restores close policy when persistence fails', () => {
		const { storage } = memoryStorage()
		const store = createAppStore(client(), storage, idFactory)
		store.getState().createScenario('Work')
		const id = store.getState().scenarios[0].id
		storage.setItem = () => {
			throw new Error('denied')
		}
		expect(store.getState().setScenarioForceClose(id, true)).toBe(false)
		expect(store.getState().scenarios[0].forceClose).toBe(false)
	})
	it('creates, renames and deletes a scenario', () => {
		const store = createAppStore(
			client(),
			memoryStorage().storage,
			idFactory,
		)

		const created = store.getState().createScenario('  Gaming  ')
		expect(created).toEqual({ ok: true, id: expect.any(String) })
		expect(store.getState().scenarios[0]?.name).toBe('Gaming')
		// The creation date is what the More card shows; only a real one is any use.
		expect(store.getState().scenarios[0]?.createdAt).toBeGreaterThan(0)

		const id = created.ok ? created.id : ''
		expect(store.getState().renameScenario(id, 'Focus')).toEqual({
			ok: true,
		})
		expect(store.getState().scenarios[0]?.name).toBe('Focus')

		store.getState().deleteScenario(id)
		expect(store.getState().scenarios).toEqual([])
	})

	// The backend refuses to terminate these whatever the window asks; refusing here is what tells
	// the user why, while they are still editing the scenario.
	it('refuses a process Windows cannot survive losing, but only in the close list', async () => {
		const security = {
			id: 'lsass',
			name: 'Local Security Authority',
			path: 'C:\\Windows\\System32\\lsass.exe',
			category: 'system',
			sourceKind: 'registry',
			launchKind: 'executable',
			closeRisk: 'close.critical',
		} as unknown as AppInfo
		const withApp = client()
		withApp.getApps = vi
			.fn()
			.mockResolvedValue({ apps: [security], hasCache: true })
		const store = createAppStore(
			withApp,
			memoryStorage().storage,
			idFactory,
		)
		await store.getState().load()
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''

		const refused = store.getState().addScenarioApp(id, 'close', 'lsass')
		expect(refused.ok).toBe(false)
		expect(store.getState().scenarios[0]?.closeIdentities).toEqual([])

		expect(store.getState().addScenarioApp(id, 'launch', 'lsass')).toEqual({
			ok: true,
		})
	})

	// The shell entries Windows ships resolve to a PIDL, not an executable, so the backend has no
	// process to end for them. Adding one used to succeed and then quietly do nothing.
	it('refuses an entry that has no process to close', async () => {
		const shell = {
			id: 'aumid:microsoft.windows.explorer',
			name: 'Проводник',
			path: 'Microsoft.Windows.Explorer',
			category: 'system',
			sourceKind: 'start_apps',
			launchKind: 'app_user_model_id',
			closeRisk: 'close.not_closable',
		} as unknown as AppInfo
		const withApp = client()
		withApp.getApps = vi
			.fn()
			.mockResolvedValue({ apps: [shell], hasCache: true })
		const store = createAppStore(
			withApp,
			memoryStorage().storage,
			idFactory,
		)
		await store.getState().load()
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''

		const refused = store
			.getState()
			.addScenarioApp(id, 'close', 'aumid:microsoft.windows.explorer')
		expect(refused.ok).toBe(false)
		expect(store.getState().scenarios[0]?.closeIdentities).toEqual([])
	})

	it('refuses a process that would end the desktop session', async () => {
		const explorer = {
			id: 'explorer',
			name: 'Проводник',
			path: 'C:\\Windows\\explorer.exe',
			category: 'system',
			sourceKind: 'start_menu',
			launchKind: 'executable',
			closeRisk: 'close.session',
		} as unknown as AppInfo
		const withApp = client()
		withApp.getApps = vi
			.fn()
			.mockResolvedValue({ apps: [explorer], hasCache: true })
		const store = createAppStore(
			withApp,
			memoryStorage().storage,
			idFactory,
		)
		await store.getState().load()
		const created = store.getState().createScenario('Reset shell')
		const id = created.ok ? created.id : ''

		expect(
			store.getState().addScenarioApp(id, 'close', 'explorer'),
		).toEqual({
			ok: false,
			error: 'Windows cannot survive closing this process, so it cannot go in a close list.',
		})
	})

	it('refuses a blank or duplicate name', () => {
		const store = createAppStore(
			client(),
			memoryStorage().storage,
			idFactory,
		)
		store.getState().createScenario('Gaming')

		expect(store.getState().createScenario('   ')).toEqual({
			ok: false,
			error: 'Enter a scenario name',
		})
		// Case-insensitive: two scenarios called Gaming and gaming are one name to a reader.
		expect(store.getState().createScenario('gaming')).toEqual({
			ok: false,
			error: 'Scenario name already exists',
		})
		expect(store.getState().scenarios).toHaveLength(1)
	})

	it('adds an app to each list and removes it again', () => {
		const store = createAppStore(
			client(),
			memoryStorage().storage,
			idFactory,
		)
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''

		expect(
			store.getState().addScenarioApp(id, 'launch', 'app:game'),
		).toEqual({
			ok: true,
		})
		expect(
			store.getState().addScenarioApp(id, 'close', 'app:chat'),
		).toEqual({
			ok: true,
		})
		expect(store.getState().scenarios[0]).toMatchObject({
			launchIdentities: ['app:game'],
			closeIdentities: ['app:chat'],
		})

		store.getState().removeScenarioApp(id, 'launch', 'app:game')
		expect(store.getState().scenarios[0]?.launchIdentities).toEqual([])
		// Removing from one list must not touch the other.
		expect(store.getState().scenarios[0]?.closeIdentities).toEqual([
			'app:chat',
		])
	})

	it('persists and removes the matching app snapshot', () => {
		const store = createAppStore(
			client(),
			memoryStorage().storage,
			idFactory,
		)
		store.setState({
			apps: [
				{
					id: 'chat',
					name: 'ChatGPT',
					path: 'C:\\Apps\\ChatGPT.exe',
					iconBase64: 'data:image/png;base64,AAAA',
					category: 'ai',
					sourceKind: 'registry',
					launchKind: 'executable',
				} as AppInfo,
			],
		})
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''

		expect(store.getState().addScenarioApp(id, 'launch', 'chat')).toEqual({
			ok: true,
		})
		expect(store.getState().scenarios[0]).toMatchObject({
			launchAppSnapshots: {
				chat: {
					name: 'ChatGPT',
					iconBase64: 'data:image/png;base64,AAAA',
				},
			},
		})

		store.getState().removeScenarioApp(id, 'launch', 'chat')
		expect(store.getState().scenarios[0]).toMatchObject({
			launchIdentities: [],
			launchAppSnapshots: {},
		})
	})

	it('rekeys scenario membership after an app update changes its identity', async () => {
		const oldCode = {
			id: 'code-old',
			name: 'Visual Studio Code',
			path: 'C:\\Apps\\Code.exe',
			category: 'development',
			sourceKind: 'registry',
			launchKind: 'executable',
			preferenceIdentity: 'preference:old-code',
		} as AppInfo
		const currentCode = {
			...oldCode,
			id: 'code-current',
			preferenceIdentity: 'preference:current-code',
		}
		const api = client()
		api.refreshApps = vi.fn().mockResolvedValue({
			apps: [currentCode],
			generation: 2,
		})
		const { storage, values } = memoryStorage()
		const store = createAppStore(api, storage, idFactory)
		store.setState({ apps: [oldCode] })
		const created = store.getState().createScenario('Development')
		const id = created.ok ? created.id : ''
		store.getState().addScenarioApp(id, 'close', 'preference:old-code')

		await store.getState().refresh()

		expect(store.getState().scenarios[0]).toMatchObject({
			closeIdentities: ['preference:current-code'],
			closeAppSnapshots: {
				'preference:current-code': {
					name: 'Visual Studio Code',
					iconBase64: null,
				},
			},
		})
		expect(
			JSON.parse(values.get(PREFERENCES_KEY) ?? '{}').scenarios[0],
		).toMatchObject({
			closeIdentities: ['preference:current-code'],
		})
	})

	it('reports a duplicate rather than adding the same app twice', () => {
		const store = createAppStore(
			client(),
			memoryStorage().storage,
			idFactory,
		)
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''
		store.getState().addScenarioApp(id, 'launch', 'app:game')

		expect(
			store.getState().addScenarioApp(id, 'launch', 'app:game'),
		).toEqual({
			ok: false,
			error: 'Already in this list',
		})
		expect(store.getState().scenarios[0]?.launchIdentities).toEqual([
			'app:game',
		])
	})

	it('refuses an app already assigned to the opposite action list', () => {
		const store = createAppStore(
			client(),
			memoryStorage().storage,
			idFactory,
		)
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''
		store.getState().addScenarioApp(id, 'launch', 'app:game')

		expect(
			store.getState().addScenarioApp(id, 'close', 'app:game'),
		).toEqual({
			ok: false,
			error: 'An app cannot both launch and close',
		})
	})

	// One click runs the whole list, so what a list can hold is bounded at the source too.
	it('caps a list and the number of scenarios', () => {
		const store = createAppStore(
			client(),
			memoryStorage().storage,
			idFactory,
		)
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''
		for (let entry = 0; entry < MAX_SCENARIO_ENTRIES; entry += 1)
			store.getState().addScenarioApp(id, 'launch', `app:${entry}`)

		expect(
			store.getState().addScenarioApp(id, 'launch', 'app:extra'),
		).toEqual({
			ok: false,
			error: `A list holds at most ${MAX_SCENARIO_ENTRIES} apps`,
		})

		for (let index = 1; index < MAX_SCENARIOS; index += 1)
			store.getState().createScenario(`Scenario ${index}`)
		expect(store.getState().createScenario('One too many')).toEqual({
			ok: false,
			error: 'Too many scenarios',
		})
		expect(store.getState().scenarios).toHaveLength(MAX_SCENARIOS)
	})

	it('stars a scenario, unstars it and persists the choice', () => {
		const { storage, values } = memoryStorage()
		const store = createAppStore(client(), storage, idFactory)
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''

		store.getState().toggleFavoriteScenario(id)
		expect(store.getState().favoriteScenarioIds).toEqual([id])
		expect(
			JSON.parse(values.get(PREFERENCES_KEY) ?? '{}').favoriteScenarioIds,
		).toEqual([id])
		expect(
			createAppStore(client(), storage).getState().favoriteScenarioIds,
		).toEqual([id])

		store.getState().toggleFavoriteScenario(id)
		expect(store.getState().favoriteScenarioIds).toEqual([])
	})

	// A star left behind would reappear on the scenario that later reuses the id.
	it('drops the star with the scenario and ignores an unknown id', () => {
		const store = createAppStore(
			client(),
			memoryStorage().storage,
			idFactory,
		)
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''
		store.getState().toggleFavoriteScenario(id)

		store.getState().toggleFavoriteScenario('never-created')
		expect(store.getState().favoriteScenarioIds).toEqual([id])

		store.getState().deleteScenario(id)
		expect(store.getState().favoriteScenarioIds).toEqual([])
	})

	it('persists a scenario and reloads it', () => {
		const { storage, values } = memoryStorage()
		const store = createAppStore(client(), storage, idFactory)
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''
		store.getState().addScenarioApp(id, 'close', 'app:chat')

		expect(
			JSON.parse(values.get(PREFERENCES_KEY) ?? '{}').scenarios,
		).toEqual([
			{
				id,
				forceClose: false,
				name: 'Gaming',
				launchIdentities: [],
				closeIdentities: ['app:chat'],
				launchAppSnapshots: {},
				closeAppSnapshots: {},
				createdAt: expect.any(Number),
				lastRunAt: null,
			},
		])
		expect(createAppStore(client(), storage).getState().scenarios).toEqual(
			store.getState().scenarios,
		)
	})

	// The tray and the Recent filter both rank by this stamp, so it has to outlive a restart.
	it('stamps a scenario when a run starts and persists the stamp', () => {
		const { storage, values } = memoryStorage()
		const store = createAppStore(client(), storage, idFactory)
		const created = store.getState().createScenario('Gaming')
		const id = created.ok ? created.id : ''

		store.getState().markScenarioRun(id)

		const stamped = store.getState().scenarios[0].lastRunAt
		expect(stamped).toEqual(expect.any(Number))
		expect(
			JSON.parse(values.get(PREFERENCES_KEY) ?? '{}').scenarios[0]
				.lastRunAt,
		).toBe(stamped)
	})

	it('ignores a run stamp for a scenario it does not have', () => {
		const { storage } = memoryStorage()
		const store = createAppStore(client(), storage, idFactory)
		store.getState().createScenario('Gaming')

		store.getState().markScenarioRun('missing')

		expect(store.getState().scenarios[0].lastRunAt).toBeNull()
	})
})
