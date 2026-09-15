import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SavedFilterDialog } from '../../../../src/features/manage-filters'

describe('saved filter editor', () => {
	it('focuses the name and saves selected criteria', async () => {
		const onSave = vi.fn().mockReturnValue({ ok: true })
		const onClose = vi.fn()
		const user = userEvent.setup()
		render(
			<SavedFilterDialog
				filter={null}
				publishers={['Example']}
				onSave={onSave}
				onClose={onClose}
			/>,
		)
		expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
		await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Work')
		await user.click(screen.getByRole('button', { name: /Publisher/ }))
		await user.click(screen.getByRole('checkbox', { name: 'Example' }))
		await user.click(screen.getByRole('radio', { name: 'Last 7 days' }))
		await user.click(screen.getByRole('button', { name: 'Create filter' }))
		expect(onSave).toHaveBeenCalledWith(
			'Work',
			expect.objectContaining({
				publishers: ['Example'],
				addedWithinDays: 7,
			}),
		)
		expect(onClose).toHaveBeenCalledOnce()
	})
	it('searches publishers, reports selected counts, and clears the selection', async () => {
		const user = userEvent.setup()
		render(
			<SavedFilterDialog
				filter={null}
				publishers={['Adobe Systems', 'Microsoft Corporation']}
				onSave={() => ({ ok: true })}
				onClose={vi.fn()}
			/>,
		)

		const publisherToggle = screen.getByRole('button', {
			name: /Publisher/,
		})
		expect(publisherToggle).toHaveAttribute('aria-expanded', 'false')
		await user.click(publisherToggle)
		const search = screen.getByRole('searchbox', {
			name: 'Search publishers',
		})
		expect(search).toHaveAttribute('type', 'text')
		await user.type(search, 'Adobe')
		expect(
			screen.getByRole('checkbox', { name: 'Adobe Systems' }),
		).toBeVisible()
		expect(
			screen.queryByRole('checkbox', { name: 'Microsoft Corporation' }),
		).not.toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'Clear publisher search' }),
		)
		expect(search).toHaveValue('')

		await user.click(
			screen.getByRole('checkbox', { name: 'Adobe Systems' }),
		)
		expect(publisherToggle).toHaveAccessibleName(/1 selected/)
		await user.click(
			screen.getByRole('button', { name: 'Clear publishers' }),
		)
		expect(publisherToggle).toHaveAccessibleName(/No selection/)
	})
	it('collapses launch targets and exposes their selected count', async () => {
		const user = userEvent.setup()
		render(
			<SavedFilterDialog
				filter={null}
				publishers={[]}
				onSave={() => ({ ok: true })}
				onClose={vi.fn()}
			/>,
		)

		const toggle = screen.getByRole('button', { name: /Launch target/ })
		expect(toggle).toHaveAttribute('aria-expanded', 'false')
		await user.click(toggle)
		await user.click(
			screen.getByRole('checkbox', { name: 'Verified on disk' }),
		)
		expect(toggle).toHaveAccessibleName(/1 selected/)
	})
	// A source is where a record was discovered; the Steam choice also covers the client, which is a
	// Start Menu entry, so the label says both and the hint says what a source is.
	it('names the Steam source as client and library and says what a source is', () => {
		render(
			<SavedFilterDialog
				filter={null}
				publishers={[]}
				onSave={() => ({ ok: true })}
				onClose={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('checkbox', {
				name: 'Steam (client and library games)',
			}),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('checkbox', { name: 'Steam' }),
		).not.toBeInTheDocument()
		expect(screen.getByText(/Steam covers the client itself/)).toBeVisible()
	})
	it('offers a labelled danger Delete action for an existing filter', () => {
		render(
			<SavedFilterDialog
				filter={{
					id: 'work',
					name: 'Work',
					criteria: {
						sources: [],
						publishers: [],
						availability: [],
						addedWithinDays: null,
					},
				}}
				publishers={[]}
				onSave={() => ({ ok: true })}
				onDelete={vi.fn()}
				onClose={vi.fn()}
			/>,
		)

		const button = screen.getByRole('button', { name: 'Delete filter' })
		expect(button).not.toHaveTextContent('Delete')
	})
	it('keeps edits open on save failure and lets Escape cancel', async () => {
		const onClose = vi.fn()
		const user = userEvent.setup()
		render(
			<SavedFilterDialog
				filter={null}
				publishers={[]}
				onSave={() => ({ ok: false, error: 'Storage unavailable' })}
				onClose={onClose}
			/>,
		)
		await user.click(screen.getByRole('button', { name: 'Create filter' }))
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Storage unavailable',
		)
		expect(onClose).not.toHaveBeenCalled()
		await user.keyboard('{Escape}')
		expect(onClose).toHaveBeenCalledOnce()
	})
})
