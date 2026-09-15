import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGlobalShortcuts } from '../../../src/app/model/useGlobalShortcuts'

function mount(extra: { onUndo?: () => void } = {}) {
	const handlers = {
		onToggleQuickLaunch: vi.fn(),
		onToggleScenarios: vi.fn(),
		onSearchFromShortcut: vi.fn(),
		onFocusSearch: vi.fn(),
		...extra,
	}
	const view = renderHook(() => useGlobalShortcuts(handlers))
	return { ...handlers, unmount: view.unmount }
}

function press(
	key: string,
	modifiers: Partial<
		Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>
	> = {},
	target: Element = document.body,
) {
	const event = new KeyboardEvent('keydown', {
		key,
		code: /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key,
		bubbles: true,
		cancelable: true,
		...modifiers,
	})
	target.dispatchEvent(event)
	return event
}

function focusedInput(): HTMLInputElement {
	const input = document.createElement('input')
	document.body.append(input)
	input.focus()
	return input
}

afterEach(() => {
	document.body.innerHTML = ''
})

describe('useGlobalShortcuts', () => {
	it('opens quick launch on Ctrl+K and nothing else', () => {
		const view = mount()

		const event = press('k', { ctrlKey: true })

		expect(view.onToggleQuickLaunch).toHaveBeenCalledOnce()
		expect(view.onToggleScenarios).not.toHaveBeenCalled()
		expect(event.defaultPrevented).toBe(true)
	})

	// Ctrl+Shift+K also satisfies "Ctrl and K"; it has to be claimed by the scenario launcher
	// before the quick-launch branch sees it, or Shift would open the wrong dialog.
	it('opens the scenario launcher on Ctrl+Shift+K, never quick launch', () => {
		const view = mount()

		press('K', { ctrlKey: true, shiftKey: true })

		expect(view.onToggleScenarios).toHaveBeenCalledOnce()
		expect(view.onToggleQuickLaunch).not.toHaveBeenCalled()
	})

	it('accepts the command key in place of control', () => {
		const view = mount()

		press('k', { metaKey: true })
		press('K', { metaKey: true, shiftKey: true })

		expect(view.onToggleQuickLaunch).toHaveBeenCalledOnce()
		expect(view.onToggleScenarios).toHaveBeenCalledOnce()
	})

	// The letter arrives in whatever layout is active; the physical key is what the user pressed.
	it('recognises the physical K under a non-Latin layout', () => {
		const view = mount()

		const event = new KeyboardEvent('keydown', {
			key: 'л',
			code: 'KeyK',
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		})
		document.body.dispatchEvent(event)

		expect(view.onToggleQuickLaunch).toHaveBeenCalledOnce()
	})

	it('selects the search field on Ctrl+F, even while typing elsewhere', () => {
		const view = mount()
		const input = focusedInput()

		const event = press('f', { ctrlKey: true }, input)

		expect(view.onSearchFromShortcut).toHaveBeenCalledOnce()
		expect(event.defaultPrevented).toBe(true)
	})

	it('focuses search on a bare slash only outside text fields', () => {
		const view = mount()

		press('/')
		expect(view.onFocusSearch).toHaveBeenCalledOnce()

		const input = focusedInput()
		const typed = press('/', {}, input)

		expect(view.onFocusSearch).toHaveBeenCalledOnce()
		expect(typed.defaultPrevented).toBe(false)
	})

	// A desktop catalog has nothing to print; the browser dialog would only confuse.
	it('swallows Ctrl+P without calling anything', () => {
		const view = mount()

		const event = press('p', { ctrlKey: true })

		expect(event.defaultPrevented).toBe(true)
		expect(view.onToggleQuickLaunch).not.toHaveBeenCalled()
		expect(view.onToggleScenarios).not.toHaveBeenCalled()
		expect(view.onSearchFromShortcut).not.toHaveBeenCalled()
		expect(view.onFocusSearch).not.toHaveBeenCalled()
	})

	it('ignores the letters without a modifier', () => {
		const view = mount()

		press('k')
		press('f')

		expect(view.onToggleQuickLaunch).not.toHaveBeenCalled()
		expect(view.onSearchFromShortcut).not.toHaveBeenCalled()
	})

	// Ctrl+Z in a text field is the field's own undo; the catalog undo answers only outside
	// one, and only while there is something to undo, so the key keeps its browser meaning.
	it('undoes on Ctrl+Z outside text fields when an undo is offered', () => {
		const onUndo = vi.fn()
		mount({ onUndo })

		const outside = press('z', { ctrlKey: true })
		expect(onUndo).toHaveBeenCalledOnce()
		expect(outside.defaultPrevented).toBe(true)

		const input = focusedInput()
		const typed = press('z', { ctrlKey: true }, input)
		expect(onUndo).toHaveBeenCalledOnce()
		expect(typed.defaultPrevented).toBe(false)

		const redo = press('z', { ctrlKey: true, shiftKey: true })
		expect(onUndo).toHaveBeenCalledOnce()
		expect(redo.defaultPrevented).toBe(false)
	})

	it('leaves Ctrl+Z alone when nothing can be undone', () => {
		mount()

		const event = press('z', { ctrlKey: true })

		expect(event.defaultPrevented).toBe(false)
	})

	it('stops listening once unmounted', () => {
		const view = mount()
		view.unmount()

		press('k', { ctrlKey: true })

		expect(view.onToggleQuickLaunch).not.toHaveBeenCalled()
	})
})
