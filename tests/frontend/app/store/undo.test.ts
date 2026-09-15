import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '../../../../src/app/store/appStore'
import { PREFERENCES_KEY } from '../../../../src/app/store/preferences'
import {
	applyUndoPatch,
	snapshotForUndo,
	undoPatch,
	type UndoSnapshot,
} from '../../../../src/app/store/undo'
import type { AppInfo, AppsClient } from '../../../../src/entities/app'

function memoryStorage(failWritesAfter = Number.POSITIVE_INFINITY) {
	const values = new Map<string, string>()
	let writes = 0
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			writes += 1
			if (writes > failWritesAfter) throw new Error('quota exceeded')
			values.set(key, value)
		},
	} as unknown as Storage
	return { storage, values }
}

function app(id: string, name: string, category = 'utilities'): AppInfo {
	return {
		id,
		name,
		path: `C:\\${id}.exe`,
		iconBase64: null,
		category,
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
	}
}

const apps = [app('code', 'Visual Studio Code'), app('chrome', 'Google Chrome')]

function client(): AppsClient {
	return {
		getApps: vi.fn().mockResolvedValue({ apps, hasCache: true }),
		refreshApps: vi.fn().mockResolvedValue({ apps, generation: 1 }),
		cancelScan: vi.fn().mockResolvedValue(undefined),
		onScanProgress: vi.fn().mockResolvedValue(() => undefined),
		launchApp: vi.fn().mockResolvedValue(undefined),
		closeApps: vi.fn().mockResolvedValue({
			closed: 0,
			notRunning: 0,
			unavailable: 0,
			failed: 0,
		}),
		getAppDetails: vi.fn(),
		openAppFolder: vi.fn(),
	}
}

function emptySnapshot(overrides: Partial<UndoSnapshot> = {}): UndoSnapshot {
	return {
		hiddenAppIds: [],
		hiddenAppIdentities: [],
		favoriteAppIds: [],
		favoriteAppIdentities: [],
		installerAppIds: [],
		installerAppIdentities: [],
		documentAppIds: [],
		documentAppIdentities: [],
		favoriteScenarioIds: [],
		categoryOverrides: {},
		categoryOverrideIdentities: {},
		categories: [],
		scenarios: [],
		savedFilters: [],
		...overrides,
	}
}

describe('undo patches', () => {
	it('reverses list, record and entity changes without touching unrelated members', () => {
		const before = emptySnapshot({
			hiddenAppIds: ['a'],
			categoryOverrides: { a: 'games', b: 'media' },
			categories: [
				{ id: 'custom:1', label: 'Work', builtIn: false },
				{ id: 'custom:2', label: 'Play', builtIn: false },
			],
		})
		const after = emptySnapshot({
			hiddenAppIds: ['a', 'b'],
			categoryOverrides: { a: 'utilities', c: 'ai' },
			categories: [{ id: 'custom:1', label: 'Office', builtIn: false }],
		})

		const patch = undoPatch(before, after)
		expect(patch).not.toBeNull()

		const later = {
			...after,
			hiddenAppIds: ['a', 'b', 'c'],
			categoryOverrides: { ...after.categoryOverrides, d: 'ai' as const },
		}
		expect(applyUndoPatch(later, patch!)).toEqual({
			hiddenAppIds: ['a', 'c'],
			categoryOverrides: { a: 'games', b: 'media', d: 'ai' },
			categories: [
				{ id: 'custom:1', label: 'Work', builtIn: false },
				{ id: 'custom:2', label: 'Play', builtIn: false },
			],
		})
	})

	it('reports no patch when nothing that is persisted changed', () => {
		const snapshot = emptySnapshot({ scenarios: [] })
		expect(undoPatch(snapshot, { ...snapshot })).toBeNull()
		expect(snapshotForUndo({ ...snapshot, apps: [] } as never)).toEqual(
			snapshot,
		)
	})
})

describe('undo in the store', () => {
	async function ready(failWritesAfter?: number) {
		const memory = memoryStorage(failWritesAfter)
		const store = createAppStore(client(), memory.storage)
		await store.getState().load()
		return { store, ...memory }
	}

	it('restores a hidden app after a scan delta remapped the catalog', async () => {
		const { store, values } = await ready()
		store.getState().hideApp('code')
		expect(store.getState().hiddenAppIds).toEqual(['code'])
		expect(store.getState().undoable?.label).toBe('Hid Visual Studio Code')

		store.getState().applyDelta({
			generation: 2,
			upserted: [app('code', 'Visual Studio Code', 'development')],
			removedIds: ['chrome'],
			summary: { added: 0, removed: 1, updated: 1 },
		})

		expect(store.getState().undo()).toEqual({ ok: true })
		expect(store.getState().hiddenAppIds).toEqual([])
		expect(store.getState().hiddenAppIdentities).toEqual([])
		expect(store.getState().undoable).toBeNull()
		expect(store.getState().catalogGeneration).toBe(2)
		expect(JSON.parse(values.get(PREFERENCES_KEY) ?? '{}')).toMatchObject({
			hiddenAppIds: [],
		})
	})

	it('undoes only the latest change and then has nothing left to undo', async () => {
		const { store } = await ready()
		store.getState().hideApp('code')
		store.getState().hideApp('chrome')

		expect(store.getState().undo()).toEqual({ ok: true })
		expect(store.getState().hiddenAppIds).toEqual(['code'])
		expect(store.getState().undo()).toEqual({
			ok: false,
			error: 'Nothing to undo',
		})
		expect(store.getState().hiddenAppIds).toEqual(['code'])
	})

	it('reverts a move, a category rename and a scenario edit', async () => {
		const { store } = await ready()
		const created = store.getState().createCategory('Work')
		if (!created.ok) throw new Error(created.error)

		store.getState().moveApp('code', created.id)
		expect(store.getState().undoable?.label).toBe(
			'Moved Visual Studio Code to Work',
		)
		expect(store.getState().undo()).toEqual({ ok: true })
		expect(store.getState().categoryOverrides).toEqual({})

		store.getState().renameCategory(created.id, 'Office')
		expect(store.getState().undo()).toEqual({ ok: true })
		expect(
			store.getState().categories.find(entry => entry.id === created.id)
				?.label,
		).toBe('Work')

		const scenario = store.getState().createScenario('Morning')
		if (!scenario.ok) throw new Error(scenario.error)
		store.getState().addScenarioApp(scenario.id, 'launch', 'code')
		expect(store.getState().undoable?.label).toBe(
			'Added Visual Studio Code to Morning',
		)
		expect(store.getState().undo()).toEqual({ ok: true })
		expect(
			store.getState().scenarios.find(entry => entry.id === scenario.id)
				?.launchIdentities,
		).toEqual([])

		store.getState().deleteScenario(scenario.id)
		expect(store.getState().scenarios).toEqual([])
		expect(store.getState().undo()).toEqual({ ok: true })
		expect(store.getState().scenarios.map(entry => entry.name)).toEqual([
			'Morning',
		])
	})

	it('refuses to restore a category name that another category took meanwhile', async () => {
		const { store } = await ready()
		const created = store.getState().createCategory('Work')
		if (!created.ok) throw new Error(created.error)
		store.getState().renameCategory(created.id, 'Office')
		store.setState(state => ({
			categories: [
				...state.categories,
				{ id: 'custom:other', label: 'work', builtIn: false },
			],
		}))

		expect(store.getState().undo()).toEqual({
			ok: false,
			error: 'A category named Work already exists',
		})
		expect(
			store.getState().categories.find(entry => entry.id === created.id)
				?.label,
		).toBe('Office')
		expect(store.getState().undoable).not.toBeNull()
	})

	it('drops a stale entry when the preferences moved on by another route', async () => {
		const { store } = await ready()
		store.getState().hideApp('code')
		store.setState(state => ({
			preferencesRevision: state.preferencesRevision + 1,
		}))

		const result = store.getState().undo()

		expect(result.ok).toBe(false)
		expect(store.getState().undoable).toBeNull()
		expect(store.getState().hiddenAppIds).toEqual(['code'])
	})

	it('survives an app that left the catalog and a change that was already reconciled away', async () => {
		const { store } = await ready()
		store.getState().hideApp('chrome')
		store.getState().applyDelta({
			generation: 2,
			upserted: [],
			removedIds: ['chrome'],
			summary: { added: 0, removed: 1, updated: 0 },
		})

		expect(store.getState().undo()).toEqual({ ok: true })
		expect(store.getState().hiddenAppIds).toEqual([])
		expect(store.getState().hiddenAppIdentities).toEqual([])
	})

	it('keeps the undone state in memory and says so when the write fails', async () => {
		const { store } = await ready(2)
		store.getState().hideApp('code')

		const result = store.getState().undo()

		expect(result).toEqual({
			ok: false,
			error: 'Undone for this session, but the change could not be saved',
		})
		expect(store.getState().hiddenAppIds).toEqual([])
		expect(store.getState().preferencesPersisted).toBe(false)
		expect(store.getState().undoable).toBeNull()
	})

	it('forgets the undo when preferences are imported', async () => {
		const { store } = await ready()
		store.getState().hideApp('code')
		const exported = store.getState().exportPreferences()

		expect(store.getState().importPreferences(exported)).toEqual({
			ok: true,
		})
		expect(store.getState().undoable).toBeNull()
		expect(store.getState().undo()).toEqual({
			ok: false,
			error: 'Nothing to undo',
		})
	})

	it('records no undo for favorites, run marks or a change that changed nothing', async () => {
		const { store } = await ready()
		store.getState().toggleFavorite('code')
		expect(store.getState().undoable).toBeNull()

		store.getState().restoreApp('code')
		expect(store.getState().undoable).toBeNull()
	})
})
