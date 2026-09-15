import { Upload } from 'lucide-react'
import { useState } from 'react'
import type { Scenario, ScenarioImportClient } from '../../../entities/scenario'
import { ScenarioImportDialog } from './ScenarioImportDialog/ScenarioImportDialog'

interface Props {
	client: ScenarioImportClient
	existing: Scenario[]
	disabled: boolean
}

export function ImportScenarios({ client, existing, disabled }: Props) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<button
				type="button"
				disabled={disabled}
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-2 rounded-lg border border-(--border-neutral) bg-(--surface-panel) px-3 py-2 text-sm text-(--text-primary) disabled:opacity-50"
			>
				<Upload size={16} aria-hidden="true" />
				Import scenarios
			</button>
			{open && (
				<ScenarioImportDialog
					client={client}
					existing={existing}
					disabled={disabled}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	)
}
