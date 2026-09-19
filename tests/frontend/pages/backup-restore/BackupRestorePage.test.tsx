import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
	BackupRestorePage,
	type BackupRestorePageProps,
} from '../../../../src/pages/backup-restore'

function renderPage(overrides: Partial<BackupRestorePageProps> = {}) {
	const props: BackupRestorePageProps = {
		onExport: () => JSON.stringify({ version: 14 }),
		onSaveExport: vi.fn().mockResolvedValue(true),
		onValidateImport: vi.fn(() => ({ ok: true }) as const),
		onImport: vi.fn(() => ({ ok: true }) as const),
		hasLocalBackup: vi.fn(() => true),
		onRestore: vi.fn(() => ({ ok: true }) as const),
		onBack: vi.fn(),
		...overrides,
	}
	render(<BackupRestorePage {...props} />)
	return props
}

function backupFile(name: string, contents = '{"version":14}'): File {
	const file = new File([contents], name, { type: 'application/json' })
	Object.defineProperty(file, 'text', {
		value: () => Promise.resolve(contents),
	})
	return file
}

describe('BackupRestorePage', () => {
	it('returns to More and separates backup creation from recovery', async () => {
		const props = renderPage()

		expect(
			screen.getByRole('region', { name: 'Create backup' }),
		).toBeInTheDocument()
		const recovery = screen.getByRole('region', {
			name: 'Recover settings',
		})
		expect(within(recovery).getByText('From a backup file')).toBeVisible()
		expect(within(recovery).getByText('From local recovery')).toBeVisible()
		await userEvent.click(
			screen.getByRole('button', { name: 'Back to More' }),
		)

		expect(props.onBack).toHaveBeenCalledOnce()
	})

	it('disables local recovery when no valid backup is available', () => {
		renderPage({ hasLocalBackup: () => false })

		expect(screen.getByText('Not available yet')).toBeVisible()
		expect(
			screen.getByRole('button', { name: 'Restore local backup' }),
		).toBeDisabled()
	})

	it('enables local recovery when a valid backup is available', () => {
		renderPage({ hasLocalBackup: () => true })

		expect(screen.getByText('Available')).toBeVisible()
		expect(
			screen.getByRole('button', { name: 'Restore local backup' }),
		).toBeEnabled()
	})

	// The file holds preferences only; naming what is inside is the one thing a reader needs
	// before pressing any of the three actions, and nothing here may claim data the store lacks.
	it('says what a backup holds and what it leaves out', () => {
		renderPage()

		const intro = screen.getByRole('region', {
			name: 'What a backup holds',
		})
		for (const item of [
			'Categories',
			'Favorites',
			'Hidden apps',
			'Scenarios',
			'Saved filters',
			'Catalog density',
		])
			expect(within(intro).getByText(item)).toBeInTheDocument()
		expect(intro).toHaveTextContent(/not part of the file/)
		expect(screen.queryByText(/Last backup/)).not.toBeInTheDocument()
	})

	it('uses the native Save as action and does not report a cancelled export as saved', async () => {
		let resolveExport: (saved: boolean) => void
		const onSaveExport = vi.fn(
			() =>
				new Promise<boolean>(resolve => {
					resolveExport = resolve
				}),
		)
		renderPage({ onSaveExport })

		const exportButton = screen.getByRole('button', {
			name: 'Export settings',
		})
		await userEvent.click(exportButton)

		expect(onSaveExport).toHaveBeenCalledWith('{"version":14}')
		expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
		resolveExport!(false)
		await waitFor(() => expect(exportButton).not.toBeDisabled())
		expect(screen.queryByText('Settings exported.')).not.toBeInTheDocument()
	})

	it('reports export success and failure only after the save action resolves', async () => {
		renderPage({
			onSaveExport: vi
				.fn<BackupRestorePageProps['onSaveExport']>()
				.mockResolvedValueOnce(true)
				.mockRejectedValueOnce(new Error('write failed')),
		})

		await userEvent.click(
			screen.getByRole('button', { name: 'Export settings' }),
		)
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Settings exported.',
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Export settings' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Settings could not be exported.',
		)
	})

	it('validates a chosen backup and imports it only after confirmation', async () => {
		const props = renderPage()

		await userEvent.click(
			screen.getByRole('button', { name: 'Choose backup' }),
		)
		await userEvent.upload(
			screen.getByLabelText('Choose settings backup'),
			backupFile('settings.json'),
		)

		expect(props.onValidateImport).toHaveBeenCalledWith('{"version":14}')
		expect(props.onImport).not.toHaveBeenCalled()
		expect(
			screen.getByText(
				'Import settings.json? This replaces your current settings.',
			),
		).toBeInTheDocument()

		await userEvent.click(
			screen.getByRole('button', { name: 'Import backup' }),
		)

		expect(props.onImport).toHaveBeenCalledWith('{"version":14}')
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Settings imported.',
		)
	})

	it('drops the import when the confirmation is cancelled', async () => {
		const props = renderPage()
		const trigger = screen.getByRole('button', { name: 'Choose backup' })

		await userEvent.upload(
			screen.getByLabelText('Choose settings backup'),
			backupFile('settings.json'),
		)
		const confirmation = await screen.findByRole('group', {
			name: /Import settings\.json/,
		})
		expect(confirmation).toHaveFocus()
		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(props.onImport).not.toHaveBeenCalled()
		expect(trigger).toHaveFocus()
		expect(
			screen.queryByText(/^Import settings\.json\?/),
		).not.toBeInTheDocument()
	})

	it('shows the validation error and asks for nothing when the backup is invalid', async () => {
		const props = renderPage({
			onValidateImport: vi.fn(
				() => ({ ok: false, error: 'Not a KesVio backup.' }) as const,
			),
		})

		await userEvent.upload(
			screen.getByLabelText('Choose settings backup'),
			backupFile('notes.json', '{"hello":1}'),
		)

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Not a KesVio backup.',
		)
		expect(
			screen.queryByRole('button', { name: 'Import backup' }),
		).not.toBeInTheDocument()
		expect(props.onImport).not.toHaveBeenCalled()
	})

	it('rejects an oversized backup before reading it', async () => {
		const readText = vi.fn(() => Promise.resolve('{"version":14}'))
		const props = renderPage()
		const file = new File(['{}'], 'oversized.json', {
			type: 'application/json',
		})
		Object.defineProperty(file, 'size', { value: 1_048_577 })
		Object.defineProperty(file, 'text', { value: readText })

		await userEvent.upload(
			screen.getByLabelText('Choose settings backup'),
			file,
		)

		expect(readText).not.toHaveBeenCalled()
		expect(props.onValidateImport).not.toHaveBeenCalled()
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'The selected file is too large.',
		)
	})

	it('lets the same file be chosen again after a rejected pick', async () => {
		renderPage({
			onValidateImport: vi.fn(
				() => ({ ok: false, error: 'Bad.' }) as const,
			),
		})
		const input = screen.getByLabelText<HTMLInputElement>(
			'Choose settings backup',
		)

		await userEvent.upload(input, backupFile('settings.json'))

		expect(input.value).toBe('')
	})

	it('restores the local backup only after confirmation', async () => {
		const props = renderPage()
		const trigger = screen.getByRole('button', {
			name: 'Restore local backup',
		})

		await userEvent.click(trigger)
		expect(props.onRestore).not.toHaveBeenCalled()
		const confirmation = screen.getByRole('group', {
			name: /Restore the local backup/,
		})
		expect(confirmation).toHaveFocus()

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(trigger).toHaveFocus()

		await userEvent.click(trigger)

		await userEvent.click(
			screen.getByRole('button', { name: 'Restore backup' }),
		)

		expect(props.onRestore).toHaveBeenCalledOnce()
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Local backup restored.',
		)
	})

	it('shows the restore error the store reports', async () => {
		renderPage({
			onRestore: vi.fn(
				() =>
					({
						ok: false,
						error: 'No local backup exists yet.',
					}) as const,
			),
		})

		await userEvent.click(
			screen.getByRole('button', { name: 'Restore local backup' }),
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Restore backup' }),
		)

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'No local backup exists yet.',
		)
	})

	// One question at a time: asking to restore while an import is waiting replaces it.
	it('keeps a single confirmation open', async () => {
		renderPage()

		await userEvent.upload(
			screen.getByLabelText('Choose settings backup'),
			backupFile('settings.json'),
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Restore local backup' }),
		)

		expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(
			1,
		)
		expect(
			screen.queryByRole('button', { name: 'Import backup' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Restore backup' }),
		).toBeInTheDocument()
	})
})
