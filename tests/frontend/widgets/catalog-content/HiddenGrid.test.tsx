import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HiddenGrid } from '../../../../src/widgets/catalog-content/ui/HiddenGrid'
import type { AppInfo } from '../../../../src/entities/app'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../src/entities/category'

vi.mock('../../../../src/features/launch-app/model/useIsLaunching', () => ({
	useIsLaunching: () => false,
}))

const utilities: CategoryDefinition = {
	id: 'utilities',
	label: 'Utilities',
	builtIn: true,
}

function hidden(
	id: string,
	name: string,
	extra: Partial<AppInfo> = {},
): AppInfo {
	return {
		id,
		name,
		path: `C:\\Tools\\${id}.exe`,
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
		...extra,
	}
}

function props(apps: AppInfo[], onBack = vi.fn()) {
	return {
		apps,
		hasQuery: false,
		favoriteAppIds: [],
		categories: [utilities],
		categoryOrder: ['utilities'] as AppCategory[],
		onBack,
		onToggleFavorite: vi.fn(),
		onLaunch: vi.fn().mockResolvedValue(undefined),
		onMoveApp: vi.fn(),
		onInfo: vi.fn(),
		onManageInWindows: vi.fn(),
		onHide: vi.fn(),
		onRestore: vi.fn(),
		onDemote: vi.fn(),
	}
}

describe('HiddenGrid', () => {
	it('titles the view, counts what it shows and explains it', () => {
		render(
			<HiddenGrid
				{...props([hidden('a', 'Alpha'), hidden('z', 'Zeta')])}
			/>,
		)

		const view = screen.getByRole('region', { name: 'Hidden' })
		expect(
			within(view).getByRole('heading', { level: 1, name: 'Hidden' }),
		).toBeInTheDocument()
		expect(view).toHaveTextContent('2 apps')
		expect(view).toHaveTextContent(
			'Applications removed from your main catalog.',
		)
	})

	// Hidden shows the same AppRow cards as Auxiliary tools (a one-surface list was tried and
	// dropped on 18 September 2026): publisher and version under the name, Restore in the
	// card's menu like every other row action, no second visible button.
	it('shows hidden apps as the auxiliary-style card grid and restores from the menu', async () => {
		const hiddenProps = props([
			hidden('a', 'SQL Shell (psql)', {
				publisher: 'PostgreSQL Global Development Group',
			}),
			hidden('z', 'Xbox', {
				publisher: 'Microsoft Corporation',
				version: '2608.1001.17.0',
			}),
		])
		render(<HiddenGrid {...hiddenProps} />)

		const cards = screen.getAllByRole('article')
		expect(cards).toHaveLength(2)
		expect(cards[0]).toHaveClass('app-card-row')
		expect(cards[0]).toHaveTextContent(
			'PostgreSQL Global Development Group',
		)
		expect(cards[1]).toHaveTextContent(
			'Microsoft Corporation · 2608.1001.17.0',
		)
		expect(cards[0]?.parentElement).toHaveClass('min-[1601px]:grid-cols-3')
		expect(cards[0]?.parentElement?.parentElement).toHaveClass('max-w-3xl')
		expect(screen.queryByRole('list')).not.toBeInTheDocument()

		expect(
			screen.queryByRole('button', { name: /^Restore / }),
		).not.toBeInTheDocument()
		await userEvent.click(
			screen.getByRole('button', { name: 'Manage Xbox' }),
		)
		await userEvent.click(
			screen.getByRole('menuitem', { name: 'Restore to catalog' }),
		)
		expect(hiddenProps.onRestore).toHaveBeenCalledWith('z')
	})

	it('shows no separator or placeholder when publisher and version are unknown', () => {
		render(<HiddenGrid {...props([hidden('a', 'Alpha')])} />)

		const row = screen.getByRole('article')
		expect(row).toHaveTextContent('Alpha')
		expect(row).not.toHaveTextContent('·')
		expect(row).not.toHaveTextContent('Unknown')
	})

	it('offers App info and Restore in the menu and nothing that hides or uninstalls', async () => {
		const hiddenProps = props([hidden('a', 'Alpha')])
		render(<HiddenGrid {...hiddenProps} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Manage Alpha' }),
		)

		const menu = screen.getByRole('menu', { name: 'Alpha actions' })
		expect(
			within(menu).getByRole('menuitem', { name: 'App info' }),
		).toBeInTheDocument()
		expect(
			within(menu).getByRole('menuitem', { name: 'Restore to catalog' }),
		).toBeInTheDocument()
		expect(
			within(menu).queryByRole('menuitem', { name: /Hide/ }),
		).not.toBeInTheDocument()
		expect(
			within(menu).queryByRole('menuitem', { name: /Uninstall/ }),
		).not.toBeInTheDocument()
		expect(screen.getByRole('article')).toHaveAttribute('data-menu-open')

		await userEvent.click(
			within(menu).getByRole('menuitem', { name: 'App info' }),
		)
		expect(hiddenProps.onInfo).toHaveBeenCalledWith(hiddenProps.apps[0])
		expect(
			screen.getByRole('button', { name: 'Manage Alpha' }),
		).toHaveFocus()
	})

	it('launches a hidden app from its name', async () => {
		const hiddenProps = props([hidden('a', 'Alpha')])
		render(<HiddenGrid {...hiddenProps} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Launch Alpha' }),
		)
		expect(hiddenProps.onLaunch).toHaveBeenCalledWith(hiddenProps.apps[0])
	})

	it('keeps every control a sibling, never a button inside a button', () => {
		render(<HiddenGrid {...props([hidden('a', 'Alpha')])} />)

		for (const button of screen.getAllByRole('button'))
			expect(button.parentElement?.closest('button')).toBeNull()
	})

	it('returns to More from the title row', async () => {
		const onBack = vi.fn()
		render(<HiddenGrid {...props([hidden('a', 'Alpha')], onBack)} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Back to More' }),
		)
		expect(onBack).toHaveBeenCalled()
	})

	it('shows an empty state with a way back while nothing is hidden', async () => {
		const onBack = vi.fn()
		render(<HiddenGrid {...props([], onBack)} />)

		expect(
			screen.getByRole('heading', { name: 'Nothing is hidden' }),
		).toBeVisible()
		expect(
			screen.getByText(
				'All applications are currently visible in your catalog.',
			),
		).toBeVisible()
		expect(
			screen.getByRole('region', { name: 'Hidden' }),
		).toHaveTextContent('0 apps')
		expect(screen.queryByRole('article')).not.toBeInTheDocument()
		const backButtons = screen.getAllByRole('button', {
			name: 'Back to More',
		})
		expect(backButtons).toHaveLength(2)
		await userEvent.click(backButtons[1]!)
		expect(onBack).toHaveBeenCalledOnce()
	})

	it('tells a fruitless search apart from an empty view', () => {
		render(<HiddenGrid {...props([])} hasQuery />)

		expect(screen.getByText('No matching hidden apps')).toBeVisible()
		expect(
			screen.getAllByRole('button', { name: 'Back to More' }),
		).toHaveLength(1)
	})
})
