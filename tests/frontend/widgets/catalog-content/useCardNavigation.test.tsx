import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	focusFirstLaunchTarget,
	useCardNavigation,
} from '../../../../src/widgets/catalog-content/model/useCardNavigation'

function container(columns: number, count: number) {
	const root = document.createElement('div')
	for (let index = 0; index < count; index += 1) {
		const button = document.createElement('button')
		button.dataset.launchTarget = ''
		button.dataset.appId = `app-${index}`
		button.getBoundingClientRect = () =>
			({
				left: (index % columns) * 100,
				top: Math.floor(index / columns) * 100,
				width: 90,
				height: 90,
			}) as DOMRect
		button.scrollIntoView = vi.fn()
		root.append(button)
	}
	document.body.append(root)
	return root
}

function press(target: Element, key: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
		...init,
	})
	target.dispatchEvent(event)
	return event
}

function mount(root: HTMLElement) {
	const onLeaveTop = vi.fn()
	const onElevate = vi.fn()
	const view = renderHook(() =>
		useCardNavigation({
			containerRef: { current: root },
			onLeaveTop,
			onElevate,
		}),
	)
	return { onLeaveTop, onElevate, view }
}

afterEach(() => {
	document.body.innerHTML = ''
})

describe('useCardNavigation', () => {
	it('moves focus between launch targets with the arrow keys', () => {
		const root = container(3, 6)
		mount(root)
		const cards = [...root.querySelectorAll('button')]
		cards[1]?.focus()

		expect(press(cards[1]!, 'ArrowDown').defaultPrevented).toBe(true)
		expect(document.activeElement).toBe(cards[4])
		press(cards[4]!, 'ArrowRight')
		expect(document.activeElement).toBe(cards[5])
	})

	// A launching card is disabled and cannot take focus; the arrows step over it.
	it('skips a card that is launching', () => {
		const root = container(3, 3)
		mount(root)
		const cards = [...root.querySelectorAll('button')]
		cards[1]!.disabled = true
		cards[0]!.focus()

		press(cards[0]!, 'ArrowRight')

		expect(document.activeElement).toBe(cards[2])
	})

	it('returns to the search field from the top row', () => {
		const root = container(3, 6)
		const view = mount(root)
		const first = root.querySelector('button')!

		press(first, 'ArrowUp')

		expect(view.onLeaveTop).toHaveBeenCalledOnce()
	})

	it('asks to run the focused card as administrator on Ctrl+Enter', () => {
		const root = container(3, 3)
		const view = mount(root)
		const card = root.querySelectorAll('button')[2]!

		expect(press(card, 'Enter', { ctrlKey: true }).defaultPrevented).toBe(
			true,
		)
		expect(view.onElevate).toHaveBeenCalledWith('app-2')
	})

	it('leaves plain Enter, Tab and keys outside launch targets alone', () => {
		const root = container(3, 3)
		const other = document.createElement('input')
		root.append(other)
		const view = mount(root)
		const card = root.querySelector('button')!

		expect(press(card, 'Enter').defaultPrevented).toBe(false)
		expect(press(card, 'Tab').defaultPrevented).toBe(false)
		expect(press(other, 'ArrowDown').defaultPrevented).toBe(false)
		expect(view.onElevate).not.toHaveBeenCalled()
	})

	it('focuses the first card on request', () => {
		const root = container(3, 3)

		focusFirstLaunchTarget(root)
		focusFirstLaunchTarget(null)

		expect(document.activeElement).toBe(root.querySelector('button'))
	})

	it('stops listening once unmounted', () => {
		const root = container(3, 6)
		const view = mount(root)
		view.view.unmount()
		const card = root.querySelectorAll('button')[1]!
		card.focus()

		expect(press(card, 'ArrowDown').defaultPrevented).toBe(false)
	})
})
