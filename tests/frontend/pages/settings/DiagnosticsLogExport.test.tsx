import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DiagnosticsLogExport } from '../../../../src/pages/settings/ui/sections/DiagnosticsLogExport/DiagnosticsLogExport'

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

	// A scrollable block of text is only reachable by keyboard when it takes focus, and a screen
	// reader only announces its name when it is a landmark, not a bare `<pre>`.
	it('exposes the preview as a named, focusable region', async () => {
		render(
			<DiagnosticsLogExport
				onExport={vi.fn()}
				onPreview={vi
					.fn()
					.mockResolvedValue('<diagnostics redacted="true" />')}
			/>,
		)

		await userEvent.click(
			screen.getByRole('button', { name: 'Preview redacted log' }),
		)

		const preview = await screen.findByRole('region', {
			name: 'Redacted diagnostics preview',
		})
		expect(preview).toHaveTextContent('<diagnostics redacted="true" />')
		await userEvent.tab()
		await userEvent.tab()
		expect(preview).toHaveFocus()
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
