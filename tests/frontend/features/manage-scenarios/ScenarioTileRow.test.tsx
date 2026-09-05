import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScenarioTileRow } from '../../../../src/features/manage-scenarios/ui/ScenarioTileRow/ScenarioTileRow'
import type { AppInfo } from '../../../../src/entities/app'

const ROW = 72

function app(index: number): AppInfo {
	return {
		id: `app-${index}`,
		name: `App ${index}`,
		path: `C:\\Apps\\app-${index}.exe`,
		iconBase64: null,
		category: 'utilities',
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
	}
}

// jsdom lays nothing out, so every tile would report the same position and the row could never tell
// where it wrapped. Standing in for the browser, this places tile N on row N/columns — the same
// answer the real layout gives, read the same way: from where the tiles actually landed.
function layoutWith(columns: number) {
	vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
		function (this: HTMLElement) {
			const siblings = this.parentElement?.children
			if (!siblings) return 0
			return Math.floor([...siblings].indexOf(this) / columns) * ROW
		},
	)
	vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(ROW)
	vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(
		function (this: Element) {
			return Math.ceil(this.children.length / columns) * ROW
		},
	)
}

function row(count: number, collapsible = true) {
	return render(
		<ScenarioTileRow
			label="Close"
			scenarioName="Evening"
			apps={Array.from({ length: count }, (_, index) => app(index))}
			unavailable={[]}
			collapsible={collapsible}
			listClassName="flex flex-wrap gap-2"
		/>,
	)
}

function reachable() {
	return screen
		.getAllByRole('listitem')
		.filter(tile => !tile.hasAttribute('inert'))
}

afterEach(() => vi.restoreAllMocks())

describe('ScenarioTileRow', () => {
	// Every tile stays in the list and stays laid out whatever is hidden, so the reading always
	// describes the whole list. Shortening the list before measuring it made each pass agree with
	// the last one and take another tile away, until two were left on a window wide enough for ten.
	it('keeps the row the layout produced and counts the rest', () => {
		layoutWith(4)

		row(10)

		expect(screen.getAllByRole('listitem')).toHaveLength(10)
		expect(reachable()).toHaveLength(4)
		expect(screen.getByText('+6')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Show all 10' }),
		).toBeInTheDocument()
	})

	it('uses the px-2 horizontal padding for the show-all control', () => {
		layoutWith(4)

		row(10)

		expect(screen.getByRole('button', { name: 'Show all 10' })).toHaveClass(
			'px-2',
		)
	})

	it('shows the rest and offers the way back', async () => {
		layoutWith(4)
		row(10)

		await userEvent.click(
			screen.getByRole('button', { name: 'Show all 10' }),
		)

		expect(reachable()).toHaveLength(10)
		expect(screen.queryByText('+6')).toBeNull()

		await userEvent.click(screen.getByRole('button', { name: 'Show less' }))

		expect(reachable()).toHaveLength(4)
	})

	// A narrower window wraps the same list sooner, so the count has to follow the layout rather
	// than repeat a number that was right at another width.
	it('holds back more when the row wraps sooner', () => {
		layoutWith(3)

		row(10)

		expect(reachable()).toHaveLength(3)
		expect(screen.getByText('+7')).toBeInTheDocument()
	})

	it('leaves a list that already fits alone', () => {
		layoutWith(8)

		row(6)

		expect(reachable()).toHaveLength(6)
		expect(screen.queryByRole('button')).toBeNull()
	})

	// The run dialog states what is about to happen, so it never hides part of the answer.
	it('never collapses where the caller did not ask for it', () => {
		layoutWith(4)

		row(10, false)

		expect(reachable()).toHaveLength(10)
		expect(screen.queryByRole('button')).toBeNull()
	})
})
