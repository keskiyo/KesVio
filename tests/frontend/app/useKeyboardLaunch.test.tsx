import { renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardLaunch } from '../../../src/app/model/useKeyboardLaunch'
import type { AppInfo } from '../../../src/entities/app'
import type { AppFileActions } from '../../../src/features/app-actions'

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))

const code = {
	id: 'code',
	name: 'Visual Studio Code',
	path: String.raw`C:\Code\Code.exe`,
	launchKind: 'executable',
} as AppInfo
const barcode = { ...code, id: 'barcode', name: 'Barcode Reader' } as AppInfo
const game = {
	...code,
	id: 'game',
	name: 'Game',
	path: 'steam://rungameid/1',
} as AppInfo

function options(
	overrides: Partial<Parameters<typeof useKeyboardLaunch>[0]> = {},
) {
	const fileActions: AppFileActions = {
		openFolder: vi.fn(),
		copyPath: vi.fn(),
		launchElevated: vi.fn().mockResolvedValue(undefined),
		canLaunchElevated: vi.fn().mockResolvedValue(true),
	}
	return {
		query: 'code',
		deferredQuery: 'code',
		results: [code, barcode],
		catalogApps: [barcode, code, game],
		hiddenAppIds: [],
		hiddenAppIdentities: [],
		fileActions,
		onLaunch: vi.fn(),
		onFocusResults: vi.fn(),
		...overrides,
	}
}

beforeEach(() => vi.mocked(toast.info).mockClear())

describe('useKeyboardLaunch', () => {
	it('offers the best ranked match, not the first card on screen', () => {
		const input = options()
		const { result } = renderHook(() => useKeyboardLaunch(input))

		expect(result.current.searchLaunch.bestMatch).toBe('Visual Studio Code')
		result.current.searchLaunch.onSubmit(false)
		expect(input.onLaunch).toHaveBeenCalledWith(code)
	})

	// The ranked list follows the deferred query; Enter pressed before it caught up would open
	// the match of the previous keystroke.
	it('offers nothing while the results still belong to an older query', () => {
		const { result } = renderHook(() =>
			useKeyboardLaunch(options({ query: 'code', deferredQuery: 'cod' })),
		)

		expect(result.current.searchLaunch.bestMatch).toBeNull()
	})

	it('offers nothing without a query', () => {
		const { result } = renderHook(() =>
			useKeyboardLaunch(options({ query: ' ', deferredQuery: ' ' })),
		)

		expect(result.current.searchLaunch.bestMatch).toBeNull()
	})

	it('runs the best match as administrator on Ctrl+Enter', async () => {
		const input = options()
		const { result } = renderHook(() => useKeyboardLaunch(input))

		result.current.searchLaunch.onSubmit(true)

		await waitFor(() =>
			expect(input.fileActions.launchElevated).toHaveBeenCalledWith(code),
		)
		expect(input.onLaunch).not.toHaveBeenCalled()
	})

	it('explains instead of elevating what the menu would not offer', async () => {
		const input = options({ hiddenAppIds: ['code'] })
		const { result } = renderHook(() => useKeyboardLaunch(input))

		result.current.elevateById('code')
		result.current.elevateById('game')

		await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(2))
		expect(toast.info).toHaveBeenCalledWith(
			'Game cannot run as administrator',
		)
		expect(input.fileActions.launchElevated).not.toHaveBeenCalled()
	})

	it('moves focus to the results on ArrowDown', () => {
		const input = options()
		const { result } = renderHook(() => useKeyboardLaunch(input))

		result.current.searchLaunch.onLeave()

		expect(input.onFocusResults).toHaveBeenCalledOnce()
	})
})
