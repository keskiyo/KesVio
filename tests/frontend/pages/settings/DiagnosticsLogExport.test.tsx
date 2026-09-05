import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DiagnosticsLogExport } from '../../../../src/pages/settings/ui/sections/DiagnosticsLogExport'

describe('DiagnosticsLogExport', () => {
	it('reports a saved log and re-enables the button', async () => {
		const onExport = vi.fn().mockResolvedValue(true)
		render(<DiagnosticsLogExport onExport={onExport} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Export log as XML' }),
		)

		expect(onExport).toHaveBeenCalledOnce()
		expect(
			await screen.findByText('Diagnostics log exported.'),
		).toBeVisible()
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Export log as XML' }),
			).toBeEnabled(),
		)
	})

	// The export is meant to be sent to someone, and a scan log names the folders it walked. The
	// caution has to be on the control, not only in the documentation nobody opens first.
	it('warns that the log names scanned folders before it is shared', () => {
		render(<DiagnosticsLogExport onExport={vi.fn()} />)

		expect(
			screen.getByText(
				'The log names the folders a scan walked, so read it before sharing it.',
			),
		).toBeVisible()
	})

	it('says nothing when the save dialog is dismissed', async () => {
		const onExport = vi.fn().mockResolvedValue(false)
		render(<DiagnosticsLogExport onExport={onExport} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Export log as XML' }),
		)

		await waitFor(() => expect(onExport).toHaveBeenCalledOnce())
		expect(
			screen.queryByText('Diagnostics log exported.'),
		).not.toBeInTheDocument()
		expect(
			screen.queryByText('Could not save the diagnostics log.'),
		).not.toBeInTheDocument()
	})

	it('keeps a failed export recoverable and shows a safe message', async () => {
		const onExport = vi
			.fn()
			.mockRejectedValue(new Error('C:\\Users\\Example\\denied'))
		render(<DiagnosticsLogExport onExport={onExport} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Export log as XML' }),
		)

		const message = await screen.findByText(
			'Could not save the diagnostics log.',
		)
		expect(message).toBeVisible()
		expect(message.textContent).not.toContain('Example')
		expect(
			screen.getByRole('button', { name: 'Export log as XML' }),
		).toBeEnabled()
	})
})
