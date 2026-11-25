import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TitleBar } from '../../../../src/app/layout/TitleBar'

it('offers an available update directly from the compact title bar', async () => {
	const onInstall = vi.fn()
	const update = {
		version: '0.6.0',
		phase: 'idle' as const,
		progress: null,
		onInstall,
	}
	render(<TitleBar {...{ update }} />)
	await userEvent.click(
		screen.getByRole('button', { name: 'Update 0.6.0 available' }),
	)
	expect(onInstall).toHaveBeenCalledOnce()
	expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
})
