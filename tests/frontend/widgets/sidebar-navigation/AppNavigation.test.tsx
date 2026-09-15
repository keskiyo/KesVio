import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppNavigation } from '../../../../src/widgets/sidebar-navigation/ui/AppNavigation/AppNavigation'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../src/entities/category'

const categories: CategoryDefinition[] = [
	{ id: 'games', label: 'Games', builtIn: true },
	{ id: 'ai', label: 'AI & Agents', builtIn: true },
	{ id: 'other', label: 'Other', builtIn: true },
]

describe('AppNavigation', () => {
	it('always distinguishes favorite app and scenario counts', () => {
		render(
			<AppNavigation
				categoryOrder={[]}
				categories={categories}
				counts={new Map()}
				activeView="all"
				appCount={3}
				favoriteCount={3}
				favoriteScenarioCount={2}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		const favorites = screen.getByRole('button', {
			name: 'Favorites 3 apps, 2 scenarios',
		})
		expect(favorites).toHaveTextContent('3 · 2')
	})

	it('uses the category label as both selector and drag activator', async () => {
		const counts = new Map<AppCategory, number>([
			['games', 2],
			['ai', 1],
		])

		const onSelectCategory = vi.fn()
		render(
			<AppNavigation
				categoryOrder={['games', 'ai', 'other']}
				categories={categories}
				counts={counts}
				activeView="all"
				appCount={3}
				favoriteCount={0}
				onSelectView={vi.fn()}
				onSelectCategory={onSelectCategory}
				onCreateCategory={() => ({ ok: true, id: 'custom' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		const games = screen.getByRole('button', { name: 'Games' })
		expect(games).toHaveAttribute('aria-roledescription', 'sortable')
		expect(games).toHaveClass('cursor-grab')
		expect(
			screen.queryByRole('button', { name: 'Reorder Games category' }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId('category-drag-icon'),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Other' }),
		).not.toBeInTheDocument()
		await userEvent.click(games)
		expect(onSelectCategory).toHaveBeenCalledWith('games')
	})

	// dnd-kit's keyboard sensor treats Enter and Space alike as "pick up", which swallowed the
	// button's own click: a keyboard user could grab a category but never open it. Enter now
	// opens; Space is the only key that picks the row up, and Escape puts it back.
	it('opens a category with Enter and reserves Space for picking it up to reorder', async () => {
		const onSelectCategory = vi.fn()
		render(
			<AppNavigation
				categoryOrder={['games', 'ai']}
				categories={categories}
				counts={
					new Map<AppCategory, number>([
						['games', 2],
						['ai', 1],
					])
				}
				activeView="all"
				appCount={3}
				favoriteCount={0}
				onSelectView={vi.fn()}
				onSelectCategory={onSelectCategory}
				onCreateCategory={() => ({ ok: true, id: 'custom' })}
				onReorderCategory={vi.fn()}
			/>,
		)
		const games = screen.getByRole('button', { name: 'Games' })
		games.focus()

		await userEvent.keyboard('{Enter}')
		expect(onSelectCategory).toHaveBeenCalledTimes(1)
		expect(games).not.toHaveAttribute('aria-pressed', 'true')

		await userEvent.keyboard(' ')
		expect(onSelectCategory).toHaveBeenCalledTimes(1)
		expect(games).toHaveAttribute('aria-pressed', 'true')

		await userEvent.keyboard('{Escape}')
		expect(games).not.toHaveAttribute('aria-pressed', 'true')
		expect(onSelectCategory).toHaveBeenCalledTimes(1)
	})

	// Saved filters are few and are what the user reaches for; categories can run past the fold,
	// so the filters sit above them instead of after the last category.
	it('lists saved filters before the categories', () => {
		render(
			<AppNavigation
				categoryOrder={['games', 'ai', 'other']}
				categories={categories}
				counts={new Map<AppCategory, number>([['games', 1]])}
				activeView="all"
				appCount={1}
				favoriteCount={0}
				savedFilters={{
					filters: [
						{
							id: 'filter:work',
							name: 'Work',
							criteria: {
								sources: [],
								publishers: [],
								availability: [],
								addedWithinDays: null,
							},
						},
					],
					activeId: null,
					onSelect: vi.fn(),
					onCreate: vi.fn(),
					onDelete: vi.fn(),
				}}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		const work = screen.getByRole('button', { name: 'Work' })
		const games = screen.getByRole('button', { name: 'Games' })
		const settings = screen.getByRole('button', { name: 'Settings' })
		expect(
			settings.compareDocumentPosition(work) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		expect(
			work.compareDocumentPosition(games) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})

	it('deletes a saved filter from its row without selecting it', async () => {
		const onSelect = vi.fn()
		const onDelete = vi.fn()
		render(
			<AppNavigation
				categoryOrder={[]}
				categories={categories}
				counts={new Map()}
				activeView="all"
				appCount={1}
				favoriteCount={0}
				savedFilters={{
					filters: [
						{
							id: 'filter:work',
							name: 'Work',
							criteria: {
								sources: [],
								publishers: [],
								availability: [],
								addedWithinDays: null,
							},
						},
					],
					activeId: 'filter:work',
					onSelect,
					onCreate: vi.fn(),
					onDelete,
				}}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		await userEvent.click(
			screen.getByRole('button', { name: 'Delete Work filter' }),
		)
		expect(
			screen.getByRole('alertdialog', { name: 'Delete Work filter' }),
		).toBeInTheDocument()
		expect(onDelete).not.toHaveBeenCalled()
		expect(onSelect).not.toHaveBeenCalled()

		await userEvent.click(
			screen.getByRole('button', { name: 'Delete filter' }),
		)
		expect(onDelete).toHaveBeenCalledWith('filter:work')
		expect(onSelect).not.toHaveBeenCalled()
	})

	it('replaces the utility rows with a More entry above Settings', async () => {
		const onSelectView = vi.fn()
		render(
			<AppNavigation
				categoryOrder={[]}
				categories={categories}
				counts={new Map()}
				activeView="all"
				appCount={3}
				favoriteCount={0}
				onSelectView={onSelectView}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		// Auxiliary tools and Hidden are reachable through More, not from the sidebar itself.
		expect(
			screen.queryByRole('button', { name: /Auxiliary tools/ }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: /Hidden/ }),
		).not.toBeInTheDocument()

		const more = screen.getByRole('button', { name: 'More' })
		const settings = screen.getByRole('button', { name: 'Settings' })
		expect(more.querySelector('svg.lucide-wand-sparkles')).not.toBeNull()
		expect(
			more.compareDocumentPosition(settings) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()

		await userEvent.click(more)
		expect(onSelectView).toHaveBeenCalledWith('more')
	})

	it('keeps the Installers & Docs artifact bucket out of the category list', () => {
		render(
			<AppNavigation
				categoryOrder={['games', 'installers_docs']}
				categories={[
					...categories,
					{
						id: 'installers_docs',
						label: 'Installers & Docs',
						builtIn: true,
					},
				]}
				counts={
					new Map([
						['games', 2],
						['installers_docs', 9],
					])
				}
				activeView="all"
				appCount={3}
				favoriteCount={0}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('button', { name: 'Games' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Installers & Docs' }),
		).not.toBeInTheDocument()
	})

	it('keeps the neutral fallback for a legacy category without an accent', () => {
		const custom: CategoryDefinition = {
			id: 'custom-tools',
			label: 'Custom tools',
			builtIn: false,
		}
		render(
			<AppNavigation
				categoryOrder={['custom-tools']}
				categories={[...categories, custom]}
				counts={new Map([['custom-tools', 1]])}
				activeView="all"
				appCount={3}
				favoriteCount={0}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom-tools' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('button', { name: 'Custom tools' }),
		).toHaveAttribute('data-category-accent', 'neutral')
	})

	it('uses the persisted accent for a custom category', () => {
		const custom: CategoryDefinition = {
			id: 'custom-tools',
			label: 'Custom tools',
			builtIn: false,
			accent: 'orange',
		}
		render(
			<AppNavigation
				categoryOrder={['custom-tools']}
				categories={[...categories, custom]}
				counts={new Map([['custom-tools', 1]])}
				activeView="all"
				appCount={3}
				favoriteCount={0}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom-tools' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('button', { name: 'Custom tools' }),
		).toHaveAttribute('data-category-accent', 'orange')
	})

	// A pulled stick leaves its drive category with no apps; the sidebar drops it until the next
	// scan finds the stick again, while a category the user created stays so apps can be moved in.
	it('hides an empty drive category but keeps an empty user category', () => {
		const drive: CategoryDefinition = {
			id: 'drive:f',
			label: 'Disk F',
			builtIn: false,
		}
		const custom: CategoryDefinition = {
			id: 'custom:work',
			label: 'Work',
			builtIn: false,
		}
		const { rerender } = render(
			<AppNavigation
				categoryOrder={['drive:f', 'custom:work']}
				categories={[...categories, drive, custom]}
				counts={new Map()}
				activeView="all"
				appCount={0}
				favoriteCount={0}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom:work' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		expect(
			screen.queryByRole('button', { name: 'Disk F' }),
		).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Work' })).toBeInTheDocument()

		rerender(
			<AppNavigation
				categoryOrder={['drive:f', 'custom:work']}
				categories={[...categories, drive, custom]}
				counts={new Map([['drive:f', 4]])}
				activeView="all"
				appCount={4}
				favoriteCount={0}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom:work' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('button', { name: 'Disk F' }),
		).toBeInTheDocument()
	})

	it('assigns the games category its stable yellow accent', () => {
		render(
			<AppNavigation
				categoryOrder={['games']}
				categories={categories}
				counts={new Map([['games', 2]])}
				activeView="all"
				appCount={3}
				favoriteCount={0}
				onSelectView={vi.fn()}
				onSelectCategory={vi.fn()}
				onCreateCategory={() => ({ ok: true, id: 'custom' })}
				onReorderCategory={vi.fn()}
			/>,
		)

		expect(screen.getByRole('button', { name: 'Games' })).toHaveAttribute(
			'data-category-accent',
			'yellow',
		)
	})
})
