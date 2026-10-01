import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '../../../../src/app/store/appStore'
import {
	pruneFirstSeen,
	reconcileFirstSeen,
} from '../../../../src/app/store/firstSeen'
import type { AppInfo, AppsClient } from '../../../../src/entities/app'

function app(id: string, volumeId: string | null = null): AppInfo {
	return {
		id,
		name: id,
		path: `C:\\${id}.exe`,
		iconBase64: null,
		category: 'utilities',
		launchKind: 'executable',
		sourceKind: volumeId ? 'portable' : 'registry',
		platformKind: volumeId ? 'portable' : null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		preferenceIdentity: `identity:${id}`,
		volumeId,
	}
}

const empty = { firstSeenAt: {}, firstSeenVolumes: {} }

describe('first-seen stamps', () => {
	it('stamps a new identity once and remembers the volume it came from', () => {
		const first = reconcileFirstSeen(
			[app('editor'), app('tool', 'stick')],
			empty,
			100,
		)
		expect(first).toEqual({
			firstSeenAt: { 'identity:editor': 100, 'identity:tool': 100 },
			firstSeenVolumes: { 'identity:tool': 'stick' },
		})
		expect(
			reconcileFirstSeen(
				[app('editor'), app('tool', 'stick')],
				first,
				200,
			),
		).toBe(first)
	})

	it('keeps the stamps of an unmounted volume and prunes everything else that left', () => {
		const stamped = reconcileFirstSeen(
			[
				app('editor'),
				app('gone'),
				app('tool', 'stick'),
				app('old', 'disk'),
			],
			empty,
			100,
		)

		const pruned = pruneFirstSeen(
			[app('editor'), app('new', 'disk')],
			stamped,
		)

		expect(pruned.firstSeenAt).toEqual({
			'identity:editor': 100,
			'identity:tool': 100,
		})
		expect(pruned.firstSeenVolumes).toEqual({ 'identity:tool': 'stick' })
	})
})

// A portable app on a USB stick left the catalog whenever the stick was unplugged, the completed
// scan pruned its stamp, and plugging the stick back in listed every app on it as recently added.
describe('recently added across a removable volume', () => {
	it('keeps the original stamp through removal, a restart and reconnection', async () => {
		vi.useFakeTimers()
		try {
			const values = new Map<string, string>()
			const storage = {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) =>
					void values.set(key, value),
			} as unknown as Storage
			const scans = [
				[app('editor'), app('tool', 'stick')],
				[app('editor')],
				[app('editor')],
				[app('editor'), app('tool', 'stick')],
			]
			let generation = 0
			const client = {
				getApps: vi
					.fn()
					.mockResolvedValue({ apps: [], hasCache: false }),
				refreshApps: vi.fn(async () => ({
					apps: scans[generation] ?? [],
					generation: ++generation,
				})),
				cancelScan: vi.fn(),
			} as unknown as AppsClient

			vi.setSystemTime(1_000)
			const before = createAppStore(client, storage)
			await before.getState().refresh()
			const stamped = before.getState().firstSeenAt['identity:tool']
			vi.setSystemTime(2_000)
			await before.getState().refresh()

			const after = createAppStore(client, storage)
			vi.setSystemTime(3_000)
			await after.getState().refresh()
			vi.setSystemTime(4_000)
			await after.getState().refresh()

			expect(stamped).toBe(1_000)
			expect(after.getState().firstSeenAt['identity:tool']).toBe(1_000)
		} finally {
			vi.useRealTimers()
		}
	})
})
