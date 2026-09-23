import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UpdatePill } from '../../../../src/features/update-app'
import type { UpdateInstallPhase } from '../../../../src/features/update-app'

function pill(phase: UpdateInstallPhase, progress: number | null = null) {
	const onInstall = vi.fn()
	render(
		<UpdatePill
			version="0.5.4"
			phase={phase}
			progress={progress}
			onInstall={onInstall}
		/>,
	)
	return onInstall
}

describe('UpdatePill', () => {
	// The update dialog was withdrawn: the pill itself starts the download, so one click must
	// install without any confirmation step in between.
	it('installs the available update on the first click', async () => {
		const onInstall = pill('idle')

		await userEvent.click(
			screen.getByRole('button', { name: 'Update 0.5.4 available' }),
		)

		expect(onInstall).toHaveBeenCalledOnce()
	})

	it('turns into a progress bar with the download percentage', () => {
		pill('downloading', 42)

		const bar = screen.getByRole('progressbar', {
			name: 'Installing update 0.5.4',
		})
		expect(bar).toHaveAttribute('aria-valuenow', '42')
		expect(bar).toHaveTextContent('Downloading 42%')
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('fills the bar once the download is done or its size is unknown', () => {
		pill('installing', 100)

		const bar = screen.getByRole('progressbar')
		expect(bar).toHaveAttribute('aria-valuenow', '100')
		expect(bar).toHaveTextContent('Installing…')
	})

	it('offers a retry after a failed installation', async () => {
		const onInstall = pill('failed')

		await userEvent.click(
			screen.getByRole('button', { name: 'Retry update 0.5.4' }),
		)

		expect(onInstall).toHaveBeenCalledOnce()
	})
})
