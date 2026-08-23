import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategorySection } from '../../../../src/widgets/catalog-content/ui/CategorySection/CategorySection'
import type { CategorySectionProps } from '../../../../src/widgets/catalog-content/ui/CategorySection/types'

function props(
	overrides: Partial<CategorySectionProps> = {},
): CategorySectionProps {
	return {
		category: 'custom:work',
		definition: {
			id: 'custom:work',
			label: 'Work',
			builtIn: false,
			accent: 'teal',
		},
		categories: [
			{
				id: 'custom:work',
				label: 'Work',
				builtIn: false,
				accent: 'teal',
			},
		],
		categoryOrder: ['custom:work'],
		apps: [],
		collapsed: false,
		favoriteIds: new Set<string>(),
		onToggle: vi.fn(),
		onToggleFavorite: vi.fn(),
		onLaunch: vi.fn().mockResolvedValue(undefined),
		onMoveApp: vi.fn(),
		onInfo: vi.fn(),
		onUninstall: vi.fn(),
		onHide: vi.fn(),
		onRestore: vi.fn(),
		onDemote: vi.fn(),
		onRenameCategory: vi.fn().mockReturnValue({ ok: true }),
		onDeleteCategory: vi.fn().mockReturnValue({ ok: true }),
		...overrides,
	}
}

describe('CategorySection', () => {
	it('withdraws the delete control while the name is being edited', async () => {
		render(<CategorySection {...props()} />)

		expect(
			screen.getByRole('button', { name: 'Delete Work category' }),
		).toBeInTheDocument()

		await userEvent.click(
			screen.getByRole('button', { name: 'Rename Work category' }),
		)

		expect(
			screen.queryByRole('button', { name: 'Delete Work category' }),
		).toBeNull()

		await userEvent.click(
			screen.getByRole('button', { name: 'Cancel category editing' }),
		)

		expect(
			screen.getByRole('button', { name: 'Delete Work category' }),
		).toBeInTheDocument()
	})

	it('keeps the delete control withdrawn while a rename error is shown', async () => {
		render(
			<CategorySection
				{...props({
					onRenameCategory: vi.fn().mockReturnValue({
						ok: false,
						error: 'Enter a category name',
					}),
				})}
			/>,
		)

		await userEvent.click(
			screen.getByRole('button', { name: 'Rename Work category' }),
		)
		await userEvent.clear(
			screen.getByRole('textbox', { name: 'Rename Work category' }),
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Save category name' }),
		)

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Enter a category name',
		)
		expect(
			screen.queryByRole('button', { name: 'Delete Work category' }),
		).toBeNull()
	})

	it('never offers to delete a built-in category', () => {
		render(
			<CategorySection
				{...props({
					category: 'games',
					definition: { id: 'games', label: 'Games', builtIn: true },
					categories: [
						{ id: 'games', label: 'Games', builtIn: true },
					],
					categoryOrder: ['games'],
				})}
			/>,
		)

		expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull()
	})
})
