import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRememberedView } from '../../../src/app/model/useRememberedView'
import type { AppView } from '../../../src/entities/app'

function useHarness() {
	const [activeView, setActiveView] = useState<AppView>('all')
	useRememberedView({ activeView, setActiveView })
	return { activeView, setActiveView }
}

afterEach(() => {
	vi.restoreAllMocks()
	localStorage.clear()
})

// Every start used to land on All Apps, so someone who lives in Favorites had to navigate back to
// it after each restart.
describe('useRememberedView', () => {
	it('reopens the view that was open when the window closed', () => {
		localStorage.setItem('kesvio.last-view', 'favorites')

		const { result } = renderHook(useHarness)

		expect(result.current.activeView).toBe('favorites')
		expect(localStorage.getItem('kesvio.last-view')).toBe('favorites')
	})

	it('remembers each view the user opens', () => {
		const { result } = renderHook(useHarness)

		act(() => result.current.setActiveView('settings'))

		expect(localStorage.getItem('kesvio.last-view')).toBe('settings')
	})

	it('starts on All Apps when the stored value is not a view', () => {
		localStorage.setItem('kesvio.last-view', 'category:games')

		const { result } = renderHook(useHarness)

		expect(result.current.activeView).toBe('all')
	})

	it('starts on All Apps when storage cannot be read or written', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied')
		})
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('full')
		})

		const { result } = renderHook(useHarness)

		expect(result.current.activeView).toBe('all')
	})
})
