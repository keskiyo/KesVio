import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScenarioClosePolicy } from '../../../../src/features/manage-scenarios/ui/ScenarioClosePolicy'
import type { Scenario } from '../../../../src/entities/scenario'

const scenario: Scenario = {
	id: 'work',
	name: 'Work',
	launchIdentities: [],
	closeIdentities: [],
	createdAt: null,
}

describe('scenario close policy', () => {
	it('makes legacy force behavior visible and allows graceful closing', async () => {
		const onChange = vi.fn().mockReturnValue(true)
		render(
			<ScenarioClosePolicy
				scenario={scenario}
				disabled={false}
				onChange={onChange}
			/>,
		)
		expect(screen.getByRole('checkbox')).toBeChecked()
		expect(screen.getByText(/Unsaved work may be lost/)).toBeVisible()
		await userEvent.click(screen.getByRole('checkbox'))
		expect(onChange).toHaveBeenCalledWith('work', false)
	})
	it('does not report a failed save as successful or allow edits during a run', async () => {
		const onChange = vi.fn().mockReturnValue(false)
		const { rerender } = render(
			<ScenarioClosePolicy
				scenario={{ ...scenario, forceClose: false }}
				disabled={false}
				onChange={onChange}
			/>,
		)
		await userEvent.click(screen.getByRole('checkbox'))
		expect(screen.getByRole('alert')).toHaveTextContent(
			'could not be saved',
		)
		expect(screen.getByRole('checkbox')).not.toBeChecked()
		rerender(
			<ScenarioClosePolicy
				scenario={scenario}
				disabled={true}
				onChange={onChange}
			/>,
		)
		expect(screen.getByRole('checkbox')).toBeDisabled()
	})
})
