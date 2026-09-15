import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTraySearch } from '../../../src/app/model/useTraySearch'

function client(pendingIntent = false) {
	let search: (() => void) | undefined
	const stop = vi.fn()
	return {
		stop,
		searchFromTray: () => search?.(),
		takeTraySearchIntent: vi
			.fn()
			.mockResolvedValueOnce(pendingIntent)
			.mockResolvedValue(false),
		onTraySearch: vi.fn(async (handler: () => void) => {
			search = handler
			return stop
		}),
	}
}

function Harness(props: Parameters<typeof useTraySearch>[0]) {
	useTraySearch(props)
	return null
}

describe('useTraySearch', () => {
	it('focuses the search field for a tray click and switches to the catalog when needed', async () => {
		const systemClient = client()
		const onSearch = vi.fn()
		const selectView = vi.fn()
		const { rerender } = render(
			<Harness
				systemClient={systemClient}
				isCatalogView={false}
				onSearch={onSearch}
				selectView={selectView}
			/>,
		)
		await waitFor(() =>
			expect(systemClient.onTraySearch).toHaveBeenCalledOnce(),
		)

		act(() => systemClient.searchFromTray())
		expect(selectView).toHaveBeenCalledWith('all')
		expect(onSearch).toHaveBeenCalledTimes(1)

		rerender(
			<Harness
				systemClient={systemClient}
				isCatalogView
				onSearch={onSearch}
				selectView={selectView}
			/>,
		)
		act(() => systemClient.searchFromTray())
		expect(selectView).toHaveBeenCalledTimes(1)
		expect(onSearch).toHaveBeenCalledTimes(2)
	})

	// The click can land while the window is still loading, before any listener exists; the
	// intent waits on the backend and is honoured once the interface asks for it.
	it('honours a search intent raised before the listener existed, exactly once', async () => {
		const systemClient = client(true)
		const onSearch = vi.fn()
		render(
			<Harness
				systemClient={systemClient}
				isCatalogView
				onSearch={onSearch}
				selectView={vi.fn()}
			/>,
		)

		await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1))
		await act(async () => {})
		expect(onSearch).toHaveBeenCalledTimes(1)
	})

	it('tears the subscription down and ignores a click after unmount', async () => {
		const systemClient = client()
		const onSearch = vi.fn()
		const { unmount } = render(
			<Harness
				systemClient={systemClient}
				isCatalogView
				onSearch={onSearch}
				selectView={vi.fn()}
			/>,
		)
		await waitFor(() =>
			expect(systemClient.onTraySearch).toHaveBeenCalledOnce(),
		)

		unmount()
		expect(systemClient.stop).toHaveBeenCalledOnce()
		act(() => systemClient.searchFromTray())
		expect(onSearch).not.toHaveBeenCalled()
	})
})
