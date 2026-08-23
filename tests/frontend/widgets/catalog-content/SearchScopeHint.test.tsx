import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchScopeHint } from '../../../../src/widgets/catalog-content/ui/SearchScopeHint/SearchScopeHint'

describe('SearchScopeHint', () => {
	it('names only the areas that hold matches and moves to one', async () => {
		const onSelectView = vi.fn()
		render(
			<SearchScopeHint
				counts={{ all: 0, auxiliary: 3, hidden: 0, installersDocs: 1 }}
				activeView="all"
				onSelectView={onSelectView}
			/>,
		)

		expect(
			screen.getByRole('button', { name: '3 matches in Tools' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', {
				name: '1 match in Installers & docs',
			}),
		).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Hidden/ })).toBeNull()

		await userEvent.click(
			screen.getByRole('button', { name: '3 matches in Tools' }),
		)

		expect(onSelectView).toHaveBeenCalledWith('auxiliary')
	})

	// Searching inside Favorites used to answer with an empty grid and no way forward, even when the
	// catalog held the application under a name the user had almost typed.
	it('offers the whole catalog from a narrowed view', () => {
		render(
			<SearchScopeHint
				counts={{ all: 12, auxiliary: 0, hidden: 0, installersDocs: 0 }}
				activeView="favorites"
				onSelectView={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('button', { name: '12 matches in All apps' }),
		).toBeInTheDocument()
	})

	it('never offers the view the user is already reading', () => {
		for (const [activeView, label] of [
			['all', 'All apps'],
			['auxiliary', 'Tools'],
			['hidden', 'Hidden'],
			['installers_docs', 'Installers & docs'],
		] as const) {
			const { unmount } = render(
				<SearchScopeHint
					counts={{
						all: 5,
						auxiliary: 5,
						hidden: 5,
						installersDocs: 5,
					}}
					activeView={activeView}
					onSelectView={vi.fn()}
				/>,
			)

			expect(
				screen.queryByRole('button', { name: `5 matches in ${label}` }),
				activeView,
			).toBeNull()
			expect(screen.getAllByRole('button')).toHaveLength(3)
			unmount()
		}
	})

	it('stays out of the way when nothing matches elsewhere', () => {
		const { container } = render(
			<SearchScopeHint
				counts={{ all: 0, auxiliary: 0, hidden: 0, installersDocs: 0 }}
				activeView="all"
				onSelectView={vi.fn()}
			/>,
		)

		expect(container).toBeEmptyDOMElement()
	})
})
