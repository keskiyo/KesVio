import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScenarioRunDialog } from '../../../../src/features/manage-scenarios'
import type { AppInfo } from '../../../../src/entities/app'
import type { Scenario } from '../../../../src/entities/scenario'

function app(id: string, name: string): AppInfo {
	return {
		id,
		name,
		path: `C:\\Apps\\${id}.exe`,
		category: 'other',
		iconBase64: null,
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

function scenario(value: Partial<Scenario> & Pick<Scenario, 'id'>): Scenario {
	return {
		name: value.id,
		launchIdentities: [],
		closeIdentities: [],
		createdAt: null,
		...value,
	}
}

const gaming = scenario({
	id: 'gaming',
	name: 'Gaming',
	launchIdentities: ['game'],
	closeIdentities: ['chat', 'mail'],
})

function renderDialog(
	value: {
		scenarios?: Scenario[]
		apps?: AppInfo[]
		favoriteScenarioIds?: string[]
		runningId?: string | null
		isScenarioRunning?: boolean
	} = {},
) {
	const onRun = vi.fn()
	const onClose = vi.fn()
	const onToggleFavorite = vi.fn()
	render(
		<ScenarioRunDialog
			scenarios={value.scenarios ?? [gaming]}
			apps={
				value.apps ?? [
					app('game', 'Backpack Battles'),
					app('chat', 'Chat'),
					app('mail', 'Mail'),
				]
			}
			favoriteScenarioIds={value.favoriteScenarioIds ?? []}
			runningId={value.runningId ?? null}
			isScenarioRunning={value.isScenarioRunning ?? false}
			onRun={onRun}
			onToggleFavorite={onToggleFavorite}
			onClose={onClose}
		/>,
	)
	return { onRun, onClose, onToggleFavorite }
}

describe('ScenarioRunDialog', () => {
	it('is a modal dialog over the page', () => {
		renderDialog()

		const dialog = screen.getByRole('dialog', { name: 'All scenarios' })
		expect(dialog).toHaveAttribute('aria-modal', 'true')
	})

	// Picking a scenario to run is the point; its contents are what you open when unsure.
	it('lists scenarios collapsed, with the size of each list', () => {
		renderDialog()

		const toggle = screen.getByRole('button', { expanded: false })
		expect(toggle).toHaveTextContent('Gaming')
		expect(toggle).toHaveTextContent('1 launch · 2 close')
		expect(
			screen.queryByRole('list', { name: 'Launch list of Gaming' }),
		).not.toBeInTheDocument()
	})

	it('shows what a scenario starts and closes when its name is clicked', async () => {
		renderDialog()

		await userEvent.click(screen.getByRole('button', { expanded: false }))

		expect(
			screen.getByRole('button', { expanded: true }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('list', { name: 'Launch list of Gaming' }),
		).toHaveTextContent('Backpack Battles')
		const close = screen.getByRole('list', { name: 'Close list of Gaming' })
		expect(close).toHaveTextContent('Chat')
		expect(close).toHaveTextContent('Mail')
	})

	it('collapses the scenario again on a second click', async () => {
		renderDialog()

		await userEvent.click(screen.getByRole('button', { expanded: false }))
		await userEvent.click(screen.getByRole('button', { expanded: true }))

		expect(
			screen.queryByRole('list', { name: 'Launch list of Gaming' }),
		).not.toBeInTheDocument()
	})

	// This dialog runs scenarios; an edit control here would be a way to break one by mistake.
	it('never offers to remove an app from a list', async () => {
		renderDialog()

		await userEvent.click(screen.getByRole('button', { expanded: false }))

		expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
	})

	it('runs the scenario it was asked to run', async () => {
		const { onRun } = renderDialog()

		await userEvent.click(
			screen.getByRole('button', { name: 'Run Gaming' }),
		)

		expect(onRun).toHaveBeenCalledWith('gaming')
	})

	// Stored order is creation order, which would bury the scenario just made at the bottom.
	it('puts the newest scenario first and undated ones last', () => {
		renderDialog({
			scenarios: [
				scenario({ id: 'legacy', name: 'Legacy' }),
				scenario({ id: 'older', name: 'Older', createdAt: 1_000 }),
				scenario({ id: 'newest', name: 'Newest', createdAt: 2_000 }),
			],
		})

		expect(
			screen
				.getAllByRole('button', { name: /^Run / })
				.map(button => button.getAttribute('aria-label')),
		).toEqual(['Run Newest', 'Run Older', 'Run Legacy'])
	})

	it('blocks every scenario action until the active run finishes', () => {
		renderDialog({
			scenarios: [gaming, scenario({ id: 'work', name: 'Work' })],
			runningId: 'gaming',
			isScenarioRunning: true,
		})

		const run = screen.getByRole('button', { name: 'Run Gaming' })
		expect(run).toBeDisabled()
		expect(run).toHaveTextContent('Running…')
		expect(
			screen.getByRole('button', {
				name: 'Run Work unavailable while another scenario is running',
			}),
		).toBeDisabled()
	})

	it('shows the saved names for entries the catalog no longer has', async () => {
		renderDialog({
			apps: [app('game', 'Backpack Battles')],
			scenarios: [
				scenario({
					...gaming,
					closeAppSnapshots: {
						chat: { name: 'Chat', iconBase64: null },
						mail: { name: 'Mail', iconBase64: null },
					},
				}),
			],
		})

		await userEvent.click(screen.getByRole('button', { expanded: false }))

		const close = screen.getByRole('list', { name: 'Close list of Gaming' })
		expect(close).toHaveTextContent('Chat')
		expect(close).toHaveTextContent('Mail')
		expect(close).toHaveTextContent('Unavailable')
		expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
	})

	it('closes on Escape and on the close button', async () => {
		const { onClose } = renderDialog()

		await userEvent.keyboard('{Escape}')
		expect(onClose).toHaveBeenCalledOnce()

		await userEvent.click(
			screen.getByRole('button', { name: 'Close all scenarios' }),
		)
		expect(onClose).toHaveBeenCalledTimes(2)
	})

	it('starts with the keyboard in the search field', () => {
		renderDialog()

		expect(
			screen.getByRole('searchbox', { name: 'Search scenarios' }),
		).toHaveFocus()
	})

	it('narrows the list to the scenarios a query matches', async () => {
		renderDialog({
			scenarios: [gaming, scenario({ id: 'work', name: 'Work' })],
		})

		await userEvent.type(
			screen.getByRole('searchbox', { name: 'Search scenarios' }),
			'work',
		)

		expect(
			screen.getByRole('button', { name: 'Run Work' }),
		).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Run Gaming' })).toBeNull()
	})

	// The apps are why a scenario exists, so its own name is not the only way back to it.
	it('finds a scenario by an app it launches, in either keyboard layout', async () => {
		renderDialog({
			scenarios: [gaming, scenario({ id: 'work', name: 'Work' })],
		})
		const search = screen.getByRole('searchbox', {
			name: 'Search scenarios',
		})

		await userEvent.type(search, 'backpack')
		expect(
			screen.getByRole('button', { name: 'Run Gaming' }),
		).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Run Work' })).toBeNull()

		await userEvent.clear(search)
		await userEvent.type(search, 'цщкл')
		expect(
			screen.getByRole('button', { name: 'Run Work' }),
		).toBeInTheDocument()
	})

	it('offers a way out when nothing matches', async () => {
		renderDialog()

		await userEvent.type(
			screen.getByRole('searchbox', { name: 'Search scenarios' }),
			'nothing here',
		)
		expect(screen.queryByRole('button', { name: /^Run / })).toBeNull()

		await userEvent.click(
			screen.getByRole('button', { name: 'Clear search and filters' }),
		)
		expect(
			screen.getByRole('button', { name: 'Run Gaming' }),
		).toBeInTheDocument()
	})

	// Clearing removes the button that was clicked. Without somewhere to put the keyboard, focus
	// fell to `body`, and arrow keys and Enter stopped reaching the dialog that was still open.
	it('keeps the keyboard in the dialog after the clear button removes itself', async () => {
		const { onRun } = renderDialog()

		await userEvent.type(
			screen.getByRole('searchbox', { name: 'Search scenarios' }),
			'nothing here',
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Clear search and filters' }),
		)

		expect(
			screen.getByRole('searchbox', { name: 'Search scenarios' }),
		).toHaveFocus()
		await userEvent.keyboard('{ArrowDown}{Enter}')
		expect(onRun).toHaveBeenCalledWith('gaming')
	})

	it('keeps only the favorites when the favorites filter is pressed', async () => {
		renderDialog({
			scenarios: [gaming, scenario({ id: 'work', name: 'Work' })],
			favoriteScenarioIds: ['work'],
		})

		await userEvent.click(
			screen.getByRole('button', { name: /^Favorites/ }),
		)

		expect(
			screen.getByRole('button', { name: 'Run Work' }),
		).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Run Gaming' })).toBeNull()
	})

	// Reaching a scenario should not cost a trip through every control of the rows above it.
	it('moves between scenarios with the arrow keys and runs the one it reaches', async () => {
		const { onRun } = renderDialog({
			scenarios: [
				scenario({ id: 'first', name: 'First', createdAt: 2_000 }),
				scenario({ id: 'second', name: 'Second', createdAt: 1_000 }),
			],
		})

		await userEvent.keyboard('{ArrowDown}{ArrowDown}')
		expect(screen.getByRole('button', { name: 'Run Second' })).toHaveFocus()

		await userEvent.keyboard('{Enter}')
		expect(onRun).toHaveBeenCalledWith('second')
	})

	it('returns to the search field when typing continues on a row', async () => {
		renderDialog()

		await userEvent.keyboard('{ArrowDown}')
		expect(screen.getByRole('button', { name: 'Run Gaming' })).toHaveFocus()

		await userEvent.keyboard('g')
		expect(
			screen.getByRole('searchbox', { name: 'Search scenarios' }),
		).toHaveFocus()
	})

	it('marks a scenario as a favorite from the row', async () => {
		const { onToggleFavorite } = renderDialog()

		await userEvent.click(
			screen.getByRole('button', { name: 'Add Gaming to favorites' }),
		)

		expect(onToggleFavorite).toHaveBeenCalledWith('gaming')
	})

	// The sort arrow used to be decoration: it showed a direction nothing could change.
	it('reverses the order from the sort direction control', async () => {
		renderDialog({
			scenarios: [
				scenario({ id: 'first', name: 'First', createdAt: 2_000 }),
				scenario({ id: 'second', name: 'Second', createdAt: 1_000 }),
			],
		})
		const order = () =>
			screen
				.getAllByRole('button', { name: /^Run / })
				.map(button => button.getAttribute('aria-label'))
		expect(order()).toEqual(['Run First', 'Run Second'])

		const direction = screen.getByRole('button', { name: /default order/ })
		expect(direction).toHaveAttribute('aria-pressed', 'false')
		await userEvent.click(direction)

		expect(order()).toEqual(['Run Second', 'Run First'])
		expect(
			screen.getByRole('button', { name: /reversed order/ }),
		).toHaveAttribute('aria-pressed', 'true')
	})

	it('shows when a scenario last ran', () => {
		renderDialog({
			scenarios: [
				{ ...gaming, lastRunAt: Date.now() - 2 * 60 * 60 * 1000 },
			],
		})

		expect(
			screen.getByRole('button', { expanded: false }),
		).toHaveTextContent('ran 2h ago')
	})
})
