import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '../../../../src/app/store/appStore'
import type { AppInfo, AppsClient } from '../../../../src/entities/app'

const code: AppInfo = {
	id: 'code',
	name: 'Visual Studio Code',
	path: 'C:\\Code.exe',
	iconBase64: null,
	category: 'development',
	launchKind: 'executable',
	sourceKind: 'registry',
	description: null,
	version: null,
	publisher: null,
	installLocation: null,
	canUninstall: false,
}

function client(overrides: Partial<AppsClient> = {}): AppsClient {
	return {
		getApps: vi.fn().mockResolvedValue({
			apps: [code],
			hasCache: true,
			generation: 2,
		}),
		refreshApps: vi.fn().mockResolvedValue({ apps: [code], generation: 3 }),
		cancelScan: vi.fn().mockResolvedValue(undefined),
		launchApp: vi.fn().mockResolvedValue(undefined),
		closeApps: vi.fn().mockResolvedValue({
			closed: 0,
			notRunning: 0,
			unavailable: 0,
			failed: 0,
		}),
		getAppDetails: vi.fn().mockResolvedValue({
			fileSizeBytes: null,
			fileCreatedAt: null,
			fileModifiedAt: null,
			architecture: 'unknown',
			signature: 'unavailable',
			executableExists: null,
			installLocationExists: null,
		}),
		openAppFolder: vi.fn().mockResolvedValue(undefined),
		getUninstallPreview: vi.fn().mockResolvedValue({
			appName: 'Visual Studio Code',
			publisher: 'Microsoft',
			source: 'registry',
			mechanism: 'registered_command',
		}),
		uninstallApp: vi.fn().mockResolvedValue(undefined),
		onScanProgress: vi.fn().mockResolvedValue(() => undefined),
		...overrides,
	}
}

describe('incremental app store updates', () => {
	it('merges hydration patches without replacing catalog state', async () => {
		const store = createAppStore(client())
		await store.getState().load()

		store.getState().applyPatches([
			{
				id: 'code',
				generation: 2,
				iconBase64: 'data:image/png;base64,x',
				publisher: 'Microsoft',
			},
		])

		expect(store.getState().apps[0]).toMatchObject({
			id: 'code',
			iconBase64: 'data:image/png;base64,x',
			publisher: 'Microsoft',
		})
		// The patch envelope carries a generation for staleness checks; only its fields belong
		// on the catalog record.
		expect(store.getState().apps[0]).not.toHaveProperty('generation')
	})

	it('ignores stale patches and patches for removed applications', async () => {
		const store = createAppStore(client())
		await store.getState().load()

		store.getState().applyPatches([
			{ id: 'code', generation: 1, publisher: 'Stale' },
			{ id: 'missing', generation: 2, publisher: 'Missing' },
		])

		expect(store.getState().apps).toEqual([code])
	})

	it('applies stable-id deltas while keeping preferences', async () => {
		const store = createAppStore(client())
		await store.getState().load()
		store.getState().toggleFavorite('code')

		store.getState().applyDelta({
			generation: 3,
			upserted: [{ ...code, version: '2.0' }],
			removedIds: [],
			summary: { added: 0, removed: 0, updated: 1 },
		})

		expect(store.getState().apps[0].version).toBe('2.0')
		expect(store.getState().favoriteAppIds).toEqual(['code'])
	})

	// A watcher-driven scan arrives as a delta, so an application first seen that way was missing
	// from "Recently added" until the next full load.
	it('stamps applications that arrive through a delta', async () => {
		const store = createAppStore(client())
		await store.getState().load()
		const discovered = { ...code, id: 'new-tool', name: 'New Tool' }

		store.getState().applyDelta({
			generation: 3,
			upserted: [discovered],
			removedIds: [],
			summary: { added: 1, removed: 0, updated: 0 },
		})

		expect(store.getState().firstSeenAt['new-tool']).toBeGreaterThan(0)
	})
})

// A scan strips every icon from the records it returns and writes them back only through
// hydration. Committing that result verbatim blanked the whole grid, and because the commit
// also left the store on the previous generation, every patch the same scan produced was
// discarded as stale — so the icons never came back until the next launch.
describe('committing a scan result', () => {
	const cached = { ...code, iconBase64: 'data:image/png;base64,cached' }
	const scanned = { ...code, iconBase64: null }

	function storeWithCachedIcon() {
		return createAppStore(
			client({
				getApps: vi.fn().mockResolvedValue({
					apps: [cached],
					hasCache: true,
					generation: 2,
				}),
				refreshApps: vi
					.fn()
					.mockResolvedValue({ apps: [scanned], generation: 3 }),
			}),
		)
	}

	it('keeps the cached icon when the scan result carries none', async () => {
		const store = storeWithCachedIcon()
		await store.getState().load()

		await store.getState().refresh()

		expect(store.getState().apps[0].iconBase64).toBe(
			'data:image/png;base64,cached',
		)
	})

	it('applies the hydration patches emitted by the scan that just ran', async () => {
		const store = storeWithCachedIcon()
		await store.getState().load()

		await store.getState().refresh()
		store.getState().applyPatches([
			{
				id: 'code',
				generation: 3,
				iconBase64: 'data:image/png;base64,hydrated',
			},
		])

		expect(store.getState().catalogGeneration).toBe(3)
		expect(store.getState().apps[0].iconBase64).toBe(
			'data:image/png;base64,hydrated',
		)
	})
})
