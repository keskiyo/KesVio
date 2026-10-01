import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FavoritesGrid } from '../../../../src/widgets/catalog-content/ui/FavoritesGrid/FavoritesGrid'
import type { AppInfo } from '../../../../src/entities/app'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../src/entities/category'
import type { Scenario } from '../../../../src/entities/scenario'

vi.mock(
	'../../../../src/widgets/catalog-content/ui/CatalogAppCard/CatalogAppCard',
	() => ({
		CatalogAppCard: ({ app }: { app: AppInfo }) => (
			<button type="button" aria-label={`Launch ${app.name}`}>
				{app.name}
			</button>
		),
	}),
)

const games: CategoryDefinition = {
	id: 'games',
	label: 'Games',
	builtIn: true,
}

const gaming: Scenario = {
	id: 'gaming',
	name: 'Gaming',
	launchIdentities: ['steam'],
	closeIdentities: [],
	createdAt: null,
}

const work: Scenario = {
	id: 'work',
	name: 'Work',
	launchIdentities: ['gog'],
	closeIdentities: [],
	createdAt: null,
}

function favorite(id: string, name: string): AppInfo {
	return {
		id,
		name,
		path: `C:\\Games\\${id}.exe`,
		iconBase64: null,
		category: 'games',
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

function props(apps: AppInfo[], scenarios: Scenario[] = []) {
	return {
		apps,
		hasQuery: false,
		favoriteAppIds: apps.map(app => app.id),
		categories: [games],
		categoryOrder: ['games'] as AppCategory[],
		favoriteScenarios: {
			scenarios,
			apps,
			runningId: null,
			isScenarioRunning: false,
			onRun: vi.fn(),
			onToggleFavorite: vi.fn(),
		},
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

describe('FavoritesGrid', () => {
	it('titles the view and counts what it shows', () => {
		render(
			<FavoritesGrid
				{...props([favorite('steam', 'Steam'), favorite('gog', 'GOG')])}
			/>,
		)

		// The heading is the view's only label once the filter tiles are gone, and the count has
		// to be the size of this list — the app header counts the whole catalog.
		const view = screen.getByRole('region', { name: 'Favorites' })
		expect(
			within(view).getByRole('heading', { level: 1, name: 'Favorites' }),
		).toBeInTheDocument()
		expect(view).toHaveTextContent('2 applications')
		expect(within(view).getAllByRole('button')).toHaveLength(2)
	})

	it('names both blocks of the view and what each one holds', () => {
		render(
			<FavoritesGrid
				{...props([favorite('steam', 'Steam')], [gaming])}
			/>,
		)

		expect(
			screen.getByRole('region', { name: 'Scenarios' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('region', { name: 'Applications' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('heading', { level: 1, name: 'Favorites' })
				.parentElement,
		).toHaveTextContent('1 application · 1 scenario')
	})

	it('says application in the singular for one favorite', () => {
		render(<FavoritesGrid {...props([favorite('steam', 'Steam')])} />)

		expect(
			screen.getByRole('region', { name: 'Favorites' }),
		).toHaveTextContent('1 application')
	})

	it('keeps the empty state instead of a heading over nothing', () => {
		render(<FavoritesGrid {...props([])} />)

		expect(screen.getByText('No favorites yet')).toBeInTheDocument()
		expect(
			screen.queryByRole('heading', { level: 1, name: 'Favorites' }),
		).not.toBeInTheDocument()
	})

	it('lists favorite scenarios collapsed and expands one from its disclosure control', async () => {
		const steam = favorite('steam', 'Steam')
		render(<FavoritesGrid {...props([steam], [gaming])} />)

		const section = screen.getByRole('region', { name: 'Scenarios' })
		expect(
			screen.queryByRole('list', { name: 'Launch list of Gaming' }),
		).not.toBeInTheDocument()

		await userEvent.click(
			within(section).getByRole('button', {
				name: 'Gaming 1 launch · 0 close',
			}),
		)

		const launch = screen.getByRole('list', {
			name: 'Launch list of Gaming',
		})
		expect(
			within(launch).getByRole('listitem', { name: 'Steam' }),
		).toHaveAttribute('title', 'Steam')
		expect(launch).not.toHaveTextContent('Steam')
		expect(within(launch).queryByRole('button')).toBeNull()
	})

	it('shows the scenarios section even when no app is starred', () => {
		render(<FavoritesGrid {...props([], [gaming])} />)

		expect(
			screen.getByRole('region', { name: 'Scenarios' }),
		).toBeInTheDocument()
		expect(screen.queryByText('No favorites yet')).not.toBeInTheDocument()
	})

	// Nothing else in the interface names the launcher shortcut, so a starred scenario is where
	// someone who has never pressed it is standing.
	it('names the launcher shortcut beside the starred scenarios', () => {
		render(<FavoritesGrid {...props([], [gaming])} />)

		const section = screen.getByRole('region', { name: 'Scenarios' })
		expect(section).toHaveTextContent('Run from anywhere with Ctrl+Shift+K')
	})

	it('names no shortcut when no scenario is starred', () => {
		render(<FavoritesGrid {...props([favorite('steam', 'Steam')], [])} />)

		expect(screen.queryByText(/Ctrl\+Shift\+K/)).toBeNull()
	})

	it('does not advertise number-key application launching', () => {
		render(<FavoritesGrid {...props([favorite('steam', 'Steam')])} />)

		expect(screen.queryByText(/Launch with/)).toBeNull()
	})

	it('does not launch a favorite application from a number key', async () => {
		const view = props([favorite('steam', 'Steam')])
		render(<FavoritesGrid {...view} />)

		await userEvent.keyboard('1')

		expect(view.onLaunch).not.toHaveBeenCalled()
	})

	it('unstars a scenario from its own card', async () => {
		const view = props([], [gaming])
		render(<FavoritesGrid {...view} />)

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Remove Gaming from favorites',
			}),
		)

		expect(view.favoriteScenarios.onToggleFavorite).toHaveBeenCalledWith(
			'gaming',
		)
	})

	it('blocks every favorite scenario action until the active run finishes', () => {
		const view = props([], [gaming, work])

		render(
			<FavoritesGrid
				{...view}
				favoriteScenarios={{
					...view.favoriteScenarios,
					runningId: 'gaming',
					isScenarioRunning: true,
				}}
			/>,
		)

		const run = screen.getByRole('button', { name: 'Gaming is running' })
		expect(run).toBeDisabled()
		expect(run).toHaveAttribute('aria-busy', 'true')
		expect(
			screen.getByRole('button', {
				name: 'Run Work unavailable while another scenario is running',
			}),
		).toBeDisabled()
	})
})
