import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useScenarioImport } from '../../../../src/features/import-scenarios/model/useScenarioImport'

function deferred() {
	let resolve!: (text: string) => void
	const promise = new Promise<string>(done => {
		resolve = done
	})
	return { promise, resolve }
}
const file = (read: () => Promise<string>, size = 1) =>
	({ size, text: read }) as File

describe('scenario backup read lifecycle', () => {
	it('ignores the previous read when a different file finishes first', async () => {
		const first = deferred()
		const inspect = vi.fn(source => ({
			ok: true as const,
			scenarios: [],
			source,
		}))
		const { result } = renderHook(() =>
			useScenarioImport({ inspect, apply: vi.fn() }, vi.fn()),
		)
		let pending!: Promise<void>
		act(() => {
			pending = result.current.read(file(() => first.promise))
		})
		await act(async () => {
			await result.current.read(file(async () => 'new'))
		})
		await act(async () => {
			first.resolve('old')
			await pending
		})
		expect(inspect).toHaveBeenCalledTimes(1)
		expect(inspect).toHaveBeenCalledWith('new')
		expect(result.current.draft?.source).toBe('new')
	})
	it('does not parse a pending read after unmount', async () => {
		const read = deferred()
		const inspect = vi.fn()
		const { result, unmount } = renderHook(() =>
			useScenarioImport({ inspect, apply: vi.fn() }, vi.fn()),
		)
		let pending!: Promise<void>
		act(() => {
			pending = result.current.read(file(() => read.promise))
		})
		unmount()
		await act(async () => {
			read.resolve('old')
			await pending
		})
		expect(inspect).not.toHaveBeenCalled()
	})
	it('rejects oversized files before reading and reports failed reads', async () => {
		const read = vi.fn()
		const { result } = renderHook(() =>
			useScenarioImport({ inspect: vi.fn(), apply: vi.fn() }, vi.fn()),
		)
		await act(async () => {
			await result.current.read(file(read, 1_048_577))
		})
		expect(read).not.toHaveBeenCalled()
		expect(result.current.error).toContain('too large')
		await act(async () => {
			await result.current.read(
				file(async () => {
					throw new Error('private path')
				}),
			)
		})
		expect(result.current.error).toBe(
			'The selected file could not be read.',
		)
		expect(result.current.reading).toBe(false)
	})
})
