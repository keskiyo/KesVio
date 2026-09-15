import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScenarioImportDialog } from '../../../../src/features/import-scenarios/ui/ScenarioImportDialog/ScenarioImportDialog'
import type { Scenario } from '../../../../src/entities/scenario'

const imported: Scenario = {
	id: 'source',
	name: 'Work',
	launchIdentities: [],
	closeIdentities: [],
	createdAt: null,
}
function setup(fail = false) {
	const client = {
		inspect: vi.fn().mockReturnValue({ ok: true, scenarios: [imported] }),
		apply: vi
			.fn()
			.mockReturnValue(
				fail ? { ok: false, error: 'Could not save.' } : { ok: true },
			),
	}
	const onClose = vi.fn()
	render(
		<ScenarioImportDialog
			client={client}
			existing={[{ ...imported, id: 'local', name: 'Local' }]}
			disabled={false}
			onClose={onClose}
		/>,
	)
	return { client, onClose }
}
async function upload() {
	const file = new File(['backup'], 'backup.json', {
		type: 'application/json',
	})
	Object.defineProperty(file, 'text', { value: async () => 'backup' })
	await userEvent.upload(
		screen.getByLabelText('Backup file (up to 1 MB)'),
		file,
	)
	await screen.findByRole('checkbox', { name: 'Work' })
}

describe('selective scenario import dialog', () => {
	it('requires selection, defaults to copy and applies only the selected source', async () => {
		const { client, onClose } = setup()
		expect(screen.getByLabelText('Backup file (up to 1 MB)')).toHaveFocus()
		await upload()
		expect(
			screen.getByRole('button', { name: 'Import selected (0)' }),
		).toBeDisabled()
		await userEvent.click(screen.getByRole('checkbox', { name: 'Work' }))
		expect(screen.getByRole('combobox')).toHaveValue('')
		await userEvent.click(
			screen.getByRole('button', { name: 'Import selected (1)' }),
		)
		expect(client.apply).toHaveBeenCalledWith('backup', [
			{ sourceId: 'source', replaceId: null },
		])
		expect(onClose).toHaveBeenCalledOnce()
	})
	it('requires explicit replacement and keeps a failed import open for retry', async () => {
		const { client, onClose } = setup(true)
		await upload()
		await userEvent.click(screen.getByRole('checkbox', { name: 'Work' }))
		await userEvent.selectOptions(screen.getByRole('combobox'), 'local')
		await userEvent.click(
			screen.getByRole('button', { name: 'Import selected (1)' }),
		)
		expect(client.apply).toHaveBeenCalledWith('backup', [
			{ sourceId: 'source', replaceId: 'local' },
		])
		expect(screen.getByRole('alert')).toHaveTextContent('Could not save.')
		expect(screen.getByRole('checkbox')).toBeChecked()
		expect(onClose).not.toHaveBeenCalled()
	})
	it('cancels with Escape without importing anything', async () => {
		const { client, onClose } = setup()
		await upload()
		await userEvent.keyboard('{Escape}')
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
		expect(client.apply).not.toHaveBeenCalled()
	})
})
