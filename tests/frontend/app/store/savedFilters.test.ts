import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '../../../../src/app/store/appStore'
import {
	CURRENT_PREFERENCES_VERSION,
	PREFERENCES_KEY,
	normalizePreferences,
} from '../../../../src/app/store/preferences'
import { EMPTY_CRITERIA, type AppsClient } from '../../../../src/entities/app'

function ready() {
	const values = new Map<string, string>()
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value)
		},
	} as Storage
	const client: AppsClient = {
		getApps: vi
			.fn()
			.mockResolvedValue({ apps: [], hasCache: true, generation: 1 }),
		refreshApps: vi.fn(),
		cancelScan: vi.fn(),
		launchApp: vi.fn(),
		closeApps: vi.fn(),
		getAppDetails: vi.fn(),
		openAppFolder: vi.fn(),
		onScanProgress: vi.fn().mockResolvedValue(() => {}),
	}
	let id = 0
	return {
		client,
		storage,
		values,
		store: createAppStore(client, storage, () => `${++id}`),
	}
}

describe('saved filter storage', () => {
	it('persists declarative criteria and restores them on restart', () => {
		const { store, values, client, storage } = ready()
		const created = store.getState().createSavedFilter('Portable', {
			...EMPTY_CRITERIA,
			sources: ['portable'],
		})
		expect(created.ok).toBe(true)
		expect(JSON.parse(values.get(PREFERENCES_KEY)!)).toMatchObject({
			version: CURRENT_PREFERENCES_VERSION,
			savedFilters: [
				{ name: 'Portable', criteria: { sources: ['portable'] } },
			],
		})
		expect(createAppStore(client, storage).getState().savedFilters).toEqual(
			store.getState().savedFilters,
		)
		expect(client.refreshApps).not.toHaveBeenCalled()
	})

	it('rejects duplicate names and enforces the limit', () => {
		const { store } = ready()
		store.getState().createSavedFilter('Work', EMPTY_CRITERIA)
		expect(
			store.getState().createSavedFilter(' WORK ', EMPTY_CRITERIA).ok,
		).toBe(false)
		for (let i = 1; i < 20; i++)
			store.getState().createSavedFilter(`Filter ${i}`, EMPTY_CRITERIA)
		expect(
			store.getState().createSavedFilter('Overflow', EMPTY_CRITERIA).ok,
		).toBe(false)
		expect(store.getState().savedFilters).toHaveLength(20)
	})

	it('deletes and undoes a filter without replacing the live catalog', () => {
		const { store } = ready()
		store.getState().createSavedFilter('Work', EMPTY_CRITERIA)
		const filter = store.getState().savedFilters[0]
		store.getState().deleteSavedFilter(filter.id)
		expect(store.getState().activeSavedFilterId).toBeNull()
		store.getState().applyDelta({
			generation: 3,
			upserted: [],
			removedIds: [],
			summary: { added: 0, removed: 0, updated: 0 },
		})
		expect(store.getState().undo().ok).toBe(true)
		expect(store.getState().savedFilters).toEqual([filter])
		expect(store.getState().catalogGeneration).toBe(3)
	})

	it('preserves view and query when selecting within a catalog scope', () => {
		const { store } = ready()
		store.getState().createSavedFilter('Work', EMPTY_CRITERIA)
		store.getState().setActiveView('hidden')
		store.getState().setQuery('editor')
		store.getState().selectSavedFilter(store.getState().savedFilters[0].id)
		expect(store.getState().activeView).toBe('hidden')
		expect(store.getState().query).toBe('editor')
	})

	it('upgrades v20 keeping unknown data, the retired alias map included', () => {
		const result = normalizePreferences({
			version: 20,
			searchAliases: { editor: ['draw'] },
			futureData: 4,
		})
		expect(result).toMatchObject({
			version: CURRENT_PREFERENCES_VERSION,
			savedFilters: [],
			unknownFields: {
				futureData: 4,
				searchAliases: { editor: ['draw'] },
			},
		})
	})

	it('reports a failed save instead of closing the editor as successful', () => {
		const { store, storage } = ready()
		const write = storage.setItem
		storage.setItem = () => {
			throw new Error('denied')
		}
		expect(
			store.getState().createSavedFilter('Work', EMPTY_CRITERIA).ok,
		).toBe(false)
		expect(store.getState().savedFilters).toEqual([])
		expect(store.getState().activeSavedFilterId).toBeNull()
		expect(store.getState().undoable).toBeNull()
		storage.setItem = write
		expect(
			store.getState().createSavedFilter('Work', EMPTY_CRITERIA).ok,
		).toBe(true)
	})
})
