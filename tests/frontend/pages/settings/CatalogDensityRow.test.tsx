import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CatalogDensityRow } from '../../../../src/pages/settings/ui/sections/CatalogDensityRow'

describe('CatalogDensityRow', () => {
	it('groups the presets under one accessible name', () => {
		render(
			<CatalogDensityRow density="comfortable" onSetDensity={vi.fn()} />,
		)

		expect(
			screen.getByRole('group', { name: 'Catalog density' }),
		).toBeVisible()
		expect(screen.getAllByRole('radio')).toHaveLength(3)
	})

	it('marks the active preset and reports a change', async () => {
		const onSetDensity = vi.fn()
		render(
			<CatalogDensityRow density="compact" onSetDensity={onSetDensity} />,
		)

		expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked()
		expect(screen.getByRole('radio', { name: 'Dense' })).not.toBeChecked()

		await userEvent.click(screen.getByRole('radio', { name: 'Dense' }))

		expect(onSetDensity).toHaveBeenCalledWith('dense')
	})

	it('moves between presets with the arrow keys', async () => {
		const onSetDensity = vi.fn()
		render(
			<CatalogDensityRow
				density="comfortable"
				onSetDensity={onSetDensity}
			/>,
		)

		screen.getByRole('radio', { name: 'Comfortable' }).focus()
		await userEvent.keyboard('{ArrowRight}')

		expect(onSetDensity).toHaveBeenCalledWith('compact')
	})

	it('uses concise density guidance', () => {
		render(
			<CatalogDensityRow density="comfortable" onSetDensity={vi.fn()} />,
		)

		expect(screen.getByText('Choose card size.')).toBeInTheDocument()
	})
})
