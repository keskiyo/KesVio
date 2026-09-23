import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdater } from '../../../../src/features/update-app/model/useUpdater'

const check = vi.fn()
const relaunch = vi.fn()
vi.mock('@tauri-apps/plugin-updater', () => ({ check: () => check() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: () => relaunch() }))

function update(version = '0.4.2') {
	return {
		version,
		close: vi.fn().mockResolvedValue(undefined),
		download: vi.fn().mockResolvedValue(undefined),
		install: vi.fn().mockResolvedValue(undefined),
	}
}

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>(done => {
		resolve = done
	})
	return { promise, resolve }
}

beforeEach(() => {
	localStorage.clear()
	check.mockReset()
	relaunch.mockReset()
})

describe('update resource ownership', () => {
	it('closes an available update once on unmount', async () => {
		const found = update()
		check.mockResolvedValue(found)
		const { result, unmount } = renderHook(() =>
			useUpdater({ autoCheck: false }),
		)
		await act(async () => result.current.checkNow())
		expect(found.close).not.toHaveBeenCalled()
		unmount()
		await waitFor(() => expect(found.close).toHaveBeenCalledOnce())
	})
	it('closes the replaced update and keeps its replacement available', async () => {
		const first = update(),
			second = update('0.4.3')
		check.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
		const { result, unmount } = renderHook(() =>
			useUpdater({ autoCheck: false }),
		)
		await act(async () => result.current.checkNow())
		await act(async () => result.current.checkNow())
		expect(result.current.update?.version).toBe('0.4.3')
		expect(first.close).toHaveBeenCalledOnce()
		expect(second.close).not.toHaveBeenCalled()
		unmount()
		await waitFor(() => expect(second.close).toHaveBeenCalledOnce())
	})
	it.each([true, false])(
		'closes a late result after unmount (automatic=%s)',
		async automatic => {
			const found = update(),
				response = deferred<typeof found>()
			check.mockReturnValue(response.promise)
			const { result, unmount } = renderHook(() =>
				useUpdater({ autoCheck: automatic }),
			)
			let manual: Promise<void> | undefined
			if (!automatic)
				act(() => {
					manual = result.current.checkNow()
				})
			unmount()
			await act(async () => {
				response.resolve(found)
				await manual
			})
			await waitFor(() => expect(found.close).toHaveBeenCalledOnce())
		},
	)
	it('keeps a coalesced manual result when automatic checking is disabled mid-flight', async () => {
		const found = update(),
			response = deferred<typeof found>()
		check.mockReturnValue(response.promise)
		const { result } = renderHook(() => useUpdater())
		let manual!: Promise<void>
		act(() => {
			manual = result.current.checkNow()
			result.current.setAutomaticChecks(false)
		})
		await act(async () => {
			response.resolve(found)
			await manual
		})
		expect(check).toHaveBeenCalledOnce()
		expect(found.close).not.toHaveBeenCalled()
		expect(result.current.update?.version).toBe(found.version)
	})
	it('releases an automatic result when automatic checking is disabled mid-flight', async () => {
		const found = update(),
			response = deferred<typeof found>()
		check.mockReturnValue(response.promise)
		const { result } = renderHook(() => useUpdater())
		act(() => result.current.setAutomaticChecks(false))
		await act(async () => response.resolve(found))
		await waitFor(() => expect(found.close).toHaveBeenCalledOnce())
		expect(result.current.update).toBeNull()
	})
	it('does not close a shared check result during StrictMode effect replay', async () => {
		const found = update(),
			response = deferred<typeof found>()
		check.mockReturnValue(response.promise)
		const { result, unmount } = renderHook(() => useUpdater(), {
			wrapper: StrictMode,
		})
		await act(async () => response.resolve(found))
		await waitFor(() =>
			expect(result.current.update?.version).toBe(found.version),
		)
		expect(check).toHaveBeenCalledOnce()
		expect(found.close).not.toHaveBeenCalled()
		unmount()
		await waitFor(() => expect(found.close).toHaveBeenCalledOnce())
	})
	it('holds the old resource through a failed installation after a new check', async () => {
		const first = update(),
			second = update('0.4.3'),
			download = deferred<void>()
		first.download.mockReturnValue(download.promise)
		first.install.mockRejectedValue(new Error('permission denied'))
		check.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
		const { result } = renderHook(() => useUpdater({ autoCheck: false }))
		await act(async () => result.current.checkNow())
		let installing!: Promise<void>
		act(() => {
			installing = result.current.install()
		})
		await act(async () => result.current.checkNow())
		expect(first.close).not.toHaveBeenCalled()
		await act(async () => {
			download.resolve()
			await installing
		})
		expect(first.install).toHaveBeenCalledOnce()
		expect(first.close).toHaveBeenCalledOnce()
		expect(second.close).not.toHaveBeenCalled()
		expect(relaunch).not.toHaveBeenCalled()
	})
	it('releases a download after unmount without beginning installation', async () => {
		const found = update(),
			download = deferred<void>()
		found.download.mockReturnValue(download.promise)
		check.mockResolvedValue(found)
		const { result, unmount } = renderHook(() =>
			useUpdater({ autoCheck: false }),
		)
		await act(async () => result.current.checkNow())
		let installing!: Promise<void>
		act(() => {
			installing = result.current.install()
		})
		unmount()
		expect(found.close).not.toHaveBeenCalled()
		await act(async () => {
			download.resolve()
			await installing
		})
		expect(found.close).toHaveBeenCalledOnce()
		expect(found.install).not.toHaveBeenCalled()
		expect(relaunch).not.toHaveBeenCalled()
	})
	it('contains cleanup rejection when a replaced update fails to close', async () => {
		const first = update(),
			second = update('0.4.3')
		first.close.mockRejectedValue(new Error('resource missing'))
		check.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
		const { result } = renderHook(() => useUpdater({ autoCheck: false }))
		await act(async () => result.current.checkNow())
		await act(async () => result.current.checkNow())
		expect(first.close).toHaveBeenCalledOnce()
		expect(result.current.update?.version).toBe('0.4.3')
	})
})
