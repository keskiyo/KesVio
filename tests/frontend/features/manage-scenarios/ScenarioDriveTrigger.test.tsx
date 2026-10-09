import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScenarioDriveTrigger } from '../../../../src/features/manage-scenarios/ui/ScenarioDriveTrigger'
import type { Scenario } from '../../../../src/entities/scenario'

const scenario: Scenario = {
	id: 'stick',
	name: 'Stick',
	launchIdentities: [],
	closeIdentities: [],
	createdAt: null,
}
const drives = [{ volumeId: '1a2b3c4d', label: 'F:\\ (2 apps)' }]

describe('ScenarioDriveTrigger', () => {
	it('binds and unbinds a drive', async () => {
		const onChange = vi.fn().mockReturnValue(true)
		render(
			<ScenarioDriveTrigger
				scenario={scenario}
				drives={drives}
				disabled={false}
				onChange={onChange}
			/>,
		)
		const select = screen.getByRole('combobox', {
			name: 'Offer to run when a drive connects',
		})

		await userEvent.selectOptions(select, '1a2b3c4d')
		expect(onChange).toHaveBeenLastCalledWith('stick', '1a2b3c4d')
		await userEvent.selectOptions(select, '')
		expect(onChange).toHaveBeenLastCalledWith('stick', null)
	})

	it('keeps a bound drive selectable while it is unplugged', () => {
		render(
			<ScenarioDriveTrigger
				scenario={{ ...scenario, triggerVolumeId: '9f9f9f9f' }}
				drives={drives}
				disabled={false}
				onChange={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('option', { name: 'A drive not connected now' }),
		).toHaveProperty('selected', true)
	})

	it('stays out of the way when no removable drive is tracked', () => {
		const { container } = render(
			<ScenarioDriveTrigger
				scenario={scenario}
				drives={[]}
				disabled={false}
				onChange={vi.fn()}
			/>,
		)
		expect(container).toBeEmptyDOMElement()
	})

	it('says when the choice could not be saved', async () => {
		render(
			<ScenarioDriveTrigger
				scenario={scenario}
				drives={drives}
				disabled={false}
				onChange={vi.fn().mockReturnValue(false)}
			/>,
		)
		await userEvent.selectOptions(screen.getByRole('combobox'), '1a2b3c4d')
		expect(screen.getByRole('alert')).toHaveTextContent(
			'The drive trigger could not be saved.',
		)
	})
})
