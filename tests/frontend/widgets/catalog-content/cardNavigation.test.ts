import { describe, expect, it } from 'vitest'
import {
	type CardBox,
	nextCardIndex,
} from '../../../../src/widgets/catalog-content/lib/cardNavigation'

function grid(columns: number, count: number, width = 100, height = 100) {
	return Array.from({ length: count }, (_, index): CardBox => ({
		left: (index % columns) * width,
		top: Math.floor(index / columns) * height,
		width: width - 10,
		height: height - 10,
	}))
}

describe('nextCardIndex', () => {
	const cards = grid(3, 8)

	it('moves along the reading order with left and right', () => {
		expect(nextCardIndex(cards, 1, 'right')).toBe(2)
		expect(nextCardIndex(cards, 3, 'left')).toBe(2)
		expect(nextCardIndex(cards, 0, 'left')).toBeNull()
		expect(nextCardIndex(cards, 7, 'right')).toBeNull()
	})

	it('moves to the card in the same column of the next or previous row', () => {
		expect(nextCardIndex(cards, 1, 'down')).toBe(4)
		expect(nextCardIndex(cards, 4, 'up')).toBe(1)
	})

	it('falls back to the closest card when the row below is shorter', () => {
		expect(nextCardIndex(cards, 5, 'down')).toBe(7)
	})

	it('reports the edge so the caller can leave the grid', () => {
		expect(nextCardIndex(cards, 1, 'up')).toBeNull()
		expect(nextCardIndex(cards, 6, 'down')).toBeNull()
	})

	// A category header sits between two grids, so the next row starts further down and
	// may be a different column count; the nearest row still wins.
	it('crosses into the next section below a header', () => {
		const sections: CardBox[] = [
			...grid(3, 3),
			...grid(2, 2).map(box => ({ ...box, top: box.top + 180 })),
		]
		expect(nextCardIndex(sections, 2, 'down')).toBe(4)
		expect(nextCardIndex(sections, 3, 'up')).toBe(0)
	})
})
