import { Download } from 'lucide-react'
import { ACTION_BUTTON_PRIMARY } from '../../../shared/ui/buttonVariants'
import { PanelHeader } from '../../../shared/ui/PanelHeader'
import { BACKUP_ACTIONS, BACKUP_SURFACE } from '../data'
import type { ExportSettingsCardProps } from '../types'

export function ExportSettingsCard({
	exporting,
	onExport,
}: ExportSettingsCardProps) {
	return (
		<section aria-label="Export settings" className={BACKUP_SURFACE}>
			<PanelHeader
				icon={Download}
				title="Export settings"
				description="Save your current preferences to a JSON file you choose where to keep."
			/>
			<p className="mt-3 mb-4 text-xs leading-5 text-(--text-muted)">
				Nothing changes in KesVio; the file is yours to move or keep.
			</p>
			<div className={BACKUP_ACTIONS}>
				<button
					type="button"
					disabled={exporting}
					onClick={() => void onExport()}
					className={ACTION_BUTTON_PRIMARY}
				>
					<Download size={16} aria-hidden="true" />
					{exporting ? 'Saving…' : 'Export settings'}
				</button>
			</div>
		</section>
	)
}
