import { afterEach, describe, expect, it, vi } from 'vitest'
import { keepFocusNearRemovedItem } from '../../../src/shared/lib/focus'

function list(...labels: string[]) {
	const container = document.createElement('div')
	for (const label of labels) {
		const item = document.createElement('article')
		const button = document.createElement('button')
		button.textContent = label
		item.append(button)
		container.append(item)
	}
	document.body.append(container)
	return [...container.children] as HTMLElement[]
}

afterEach(() => {
	vi.useRealTimers()
	document.body.innerHTML = ''
})

describe('keepFocusNearRemovedItem', () => {
	it('focuses the next item, or the previous one at the end of the list', () => {
		vi.useFakeTimers()
		const [, middle, last] = list('first', 'middle', 'last')
		keepFocusNearRemovedItem(middle)
		middle.remove()
		vi.runAllTimers()
		expect(document.activeElement).toBe(last.querySelector('button'))

		const [, tail] = list('a', 'b')
		keepFocusNearRemovedItem(tail)
		tail.remove()
		;(document.activeElement as HTMLElement).blur()
		vi.runAllTimers()
		expect(document.activeElement?.textContent).toBe('a')
	})

	it('leaves focus alone when the item stayed or the user moved on', () => {
		vi.useFakeTimers()
		const [first, second] = list('first', 'second')
		keepFocusNearRemovedItem(first)
		vi.runAllTimers()
		expect(document.activeElement).toBe(document.body)

		const outside = document.createElement('input')
		document.body.append(outside)
		keepFocusNearRemovedItem(second)
		second.remove()
		outside.focus()
		vi.runAllTimers()
		expect(document.activeElement).toBe(outside)
	})
})
