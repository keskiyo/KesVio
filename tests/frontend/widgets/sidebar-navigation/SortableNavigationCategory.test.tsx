import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SortableNavigationCategory } from '../../../../src/widgets/sidebar-navigation/ui/SortableNavigationCategory/SortableNavigationCategory'
import { categoryAccent } from '../../../../src/widgets/sidebar-navigation/ui/SortableNavigationCategory/data'
import { CATEGORY_ORDER } from '../../../../src/entities/category'

vi.mock('@dnd-kit/sortable', () => ({
	useSortable: () => ({
		attributes: {},
		listeners: {},
		setActivatorNodeRef: vi.fn(),
		setNodeRef: vi.fn(),
		transform: { x: 240, y: 32, scaleX: 1, scaleY: 1 },
		transition: 'transform 200ms ease',
		isDragging: true,
	}),
}))

describe('SortableNavigationCategory', () => {
	it('keeps the active source inside the sidebar layout without a transform', () => {
		render(
			<SortableNavigationCategory
				category="games"
				count={11}
				label="Games"
				onSelect={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('button', { name: 'Games' }).style.transform,
		).toBe('')
	})
})

// Three categories shared purple and two more shared cyan and green, so the sidebar read as a
// handful of repeated colours rather than a legend. Only the two Windows-owned rows are allowed to
// share one, and they do it to say they are not the user's own software.
describe('built-in category accents', () => {
	const SHARED_BY_DESIGN = ['system', 'windows_features']

	it('gives every other built-in category an accent of its own', () => {
		const distinct = CATEGORY_ORDER.filter(
			id => !SHARED_BY_DESIGN.includes(id),
		).map(id => categoryAccent(id))

		expect(new Set(distinct).size).toBe(distinct.length)
	})

	it('marks the Windows-owned rows as muted rather than colourful', () => {
		for (const id of SHARED_BY_DESIGN)
			expect(categoryAccent(id)).toBe('slate')
	})
})
