import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import {
	pickTrayFavorites,
	useTrayFavorites,
} from '../../../src/app/model/useTrayFavorites'
import type { AppInfo } from '../../../src/entities/app'

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function app(id: string, name = id): AppInfo {
	return {
		id,
		name,
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

function client() {
	let launch: ((id: string) => void) | undefined
	let show: (() => void) | undefined
	const stops = { launch: vi.fn(), show: vi.fn() }
	return {
		stops,
		launchFromTray: (id: string) => launch?.(id),
		showFromTray: () => show?.(),
		setTrayFavorites: vi.fn().mockResolvedValue(undefined),
		onTrayLaunchApp: vi.fn(async (handler: (id: string) => void) => {
			launch = handler
			return stops.launch
		}),
		onTrayShowFavorites: vi.fn(async (handler: () => void) => {
			show = handler
			return stops.show
		}),
	}
}

function Harness(props: Parameters<typeof useTrayFavorites>[0]) {
	useTrayFavorites(props)
	return null
}

describe('pickTrayFavorites', () => {
	it('keeps the favorites order, drops ids that left the catalog and caps at five', () => {
		const apps = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => app(id))

		const picked = pickTrayFavorites(apps, [
			'g',
			'missing',
			'a',
			'b',
			'c',
			'd',
			'e',
		])

		expect(picked.entries.map(entry => entry.id)).toEqual([
			'g',
			'a',
			'b',
			'c',
			'd',
		])
		expect(picked.more).toBe(true)
		expect(pickTrayFavorites(apps, ['a']).more).toBe(false)
		expect(pickTrayFavorites(apps, ['missing']).entries).toEqual([])
	})
})

describe('useTrayFavorites', () => {
	it('pushes the favorites once and again only when they change', async () => {
		const systemClient = client()
		const apps = [app('a', 'Alpha'), app('b', 'Beta')]
		const { rerender } = render(
			<Harness
				systemClient={systemClient}
				apps={apps}
				favoriteAppIds={['a']}
				onLaunch={vi.fn().mockResolvedValue(undefined)}
				selectView={vi.fn()}
			/>,
		)
		await waitFor(() =>
			expect(systemClient.setTrayFavorites).toHaveBeenCalledWith(
				[{ id: 'a', label: 'Alpha' }],
				false,
			),
		)

		rerender(
			<Harness
				systemClient={systemClient}
				apps={apps}
				favoriteAppIds={['a']}
				onLaunch={vi.fn().mockResolvedValue(undefined)}
				selectView={vi.fn()}
			/>,
		)
		expect(systemClient.setTrayFavorites).toHaveBeenCalledTimes(1)

		rerender(
			<Harness
				systemClient={systemClient}
				apps={[app('a', 'Alpha renamed'), app('b', 'Beta')]}
				favoriteAppIds={['a', 'b']}
				onLaunch={vi.fn().mockResolvedValue(undefined)}
				selectView={vi.fn()}
			/>,
		)
		await waitFor(() =>
			expect(systemClient.setTrayFavorites).toHaveBeenLastCalledWith(
				[
					{ id: 'a', label: 'Alpha renamed' },
					{ id: 'b', label: 'Beta' },
				],
				false,
			),
		)
	})

	it('launches the catalog record for a tray click and refuses a stale id', async () => {
		const systemClient = client()
		const onLaunch = vi.fn().mockResolvedValue(undefined)
		const apps = [app('a', 'Alpha')]
		render(
			<Harness
				systemClient={systemClient}
				apps={apps}
				favoriteAppIds={['a']}
				onLaunch={onLaunch}
				selectView={vi.fn()}
			/>,
		)
		await waitFor(() =>
			expect(systemClient.onTrayLaunchApp).toHaveBeenCalledOnce(),
		)

		act(() => systemClient.launchFromTray('a'))
		expect(onLaunch).toHaveBeenCalledWith(apps[0])

		act(() => systemClient.launchFromTray('gone'))
		expect(onLaunch).toHaveBeenCalledTimes(1)
		expect(toast.error).toHaveBeenCalledWith(
			'This favorite is no longer in the catalog',
		)
	})

	it('opens the favorites view and tears both subscriptions down', async () => {
		const systemClient = client()
		const selectView = vi.fn()
		const { unmount } = render(
			<Harness
				systemClient={systemClient}
				apps={[app('a')]}
				favoriteAppIds={['a']}
				onLaunch={vi.fn().mockResolvedValue(undefined)}
				selectView={selectView}
			/>,
		)
		await waitFor(() =>
			expect(systemClient.onTrayShowFavorites).toHaveBeenCalledOnce(),
		)

		act(() => systemClient.showFromTray())
		expect(selectView).toHaveBeenCalledWith('favorites')

		unmount()
		expect(systemClient.stops.launch).toHaveBeenCalledOnce()
		expect(systemClient.stops.show).toHaveBeenCalledOnce()
		act(() => systemClient.showFromTray())
		expect(selectView).toHaveBeenCalledTimes(1)
	})
})
