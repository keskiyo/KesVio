import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NavigationIdentity } from '../../../../src/widgets/sidebar-navigation/ui/NavigationIdentity'

describe('NavigationIdentity', () => {
	it('shows the running version under the name inside the home button', async () => {
		const onGoHome = vi.fn()
		render(
			<NavigationIdentity
				onGoHome={onGoHome}
				version="0.5.3"
				update={null}
			/>,
		)

		const home = screen.getByRole('button', { name: 'Go to All Apps' })
		expect(home).toHaveTextContent('Version 0.5.3')
		await userEvent.click(home)
		expect(onGoHome).toHaveBeenCalledOnce()
	})

	// A button inside a button is invalid HTML and swallows the inner click, so the update
	// action is a sibling of the home button laid over the version line.
	it('replaces the version with an update action that installs, not navigates', async () => {
		const onGoHome = vi.fn()
		const onInstall = vi.fn()
		render(
			<NavigationIdentity
				onGoHome={onGoHome}
				version="0.5.3"
				update={{
					version: '0.5.4',
					phase: 'idle',
					progress: null,
					onInstall,
				}}
			/>,
		)

		const home = screen.getByRole('button', { name: 'Go to All Apps' })
		const update = screen.getByRole('button', {
			name: 'Update 0.5.4 available',
		})
		expect(home).not.toContainElement(update)
		expect(home).not.toHaveTextContent('Version 0.5.3')
		await userEvent.click(update)
		expect(onInstall).toHaveBeenCalledOnce()
		expect(onGoHome).not.toHaveBeenCalled()
	})

	it('shows no version text before the version is known', () => {
		render(
			<NavigationIdentity
				onGoHome={vi.fn()}
				version={null}
				update={null}
			/>,
		)

		expect(
			screen.getByRole('button', { name: 'Go to All Apps' }),
		).not.toHaveTextContent(/Version/)
	})
})
