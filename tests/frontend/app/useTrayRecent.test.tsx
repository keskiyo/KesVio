import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
	pickTrayRecent,
	useTrayRecent,
} from '../../../src/app/model/useTrayRecent'
import { type AppInfo, appIdentity } from '../../../src/entities/app'

function app(id: string): AppInfo {
	return {
		id,
		name: id.toUpperCase(),
		path: `C:\\${id}.exe`,
		iconBase64: null,
		category: 'utilities',
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

const apps = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(app)

function launched(...ids: string[]) {
	return Object.fromEntries(
		ids.map((id, index) => [
			appIdentity(apps.find(entry => entry.id === id)!),
			{ count: 1, lastLaunchedAt: 1_000 + index },
		]),
	)
}

describe('pickTrayRecent', () => {
	it('lists the five most recently launched apps, newest first', () => {
		const stats = launched('a', 'b', 'c', 'd', 'e', 'f')

		expect(pickTrayRecent(apps, stats, () => false)).toEqual([
			{ id: 'f', label: 'F' },
			{ id: 'e', label: 'E' },
			{ id: 'd', label: 'D' },
			{ id: 'c', label: 'C' },
			{ id: 'b', label: 'B' },
		])
	})

	it('leaves out hidden apps and apps that were never launched', () => {
		const stats = launched('a', 'b')

		expect(
			pickTrayRecent(apps, stats, candidate => candidate.id === 'b'),
		).toEqual([{ id: 'a', label: 'A' }])
	})
})

describe('useTrayRecent', () => {
	it('sends the list once and again only when it changes', async () => {
		const setTrayRecent = vi.fn().mockResolvedValue(undefined)
		const props = {
			systemClient: { setTrayRecent },
			apps,
			appLaunchStats: launched('a'),
			hiddenAppIds: [],
			hiddenAppIdentities: [],
		}
		const { rerender } = renderHook(p => useTrayRecent(p), {
			initialProps: props,
		})
		rerender({ ...props, apps: [...apps] })
		rerender({ ...props, appLaunchStats: launched('a', 'c') })

		await waitFor(() => expect(setTrayRecent).toHaveBeenCalledTimes(2))
		expect(setTrayRecent).toHaveBeenLastCalledWith([
			{ id: 'c', label: 'C' },
			{ id: 'a', label: 'A' },
		])
	})
})
