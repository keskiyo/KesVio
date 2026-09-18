import { Upload } from 'lucide-react'
import { ACTION_BUTTON_NEUTRAL } from '../../../shared/ui/buttonVariants'
import { PanelHeader } from '../../../shared/ui/PanelHeader'
import { BACKUP_ACTIONS, BACKUP_SURFACE } from '../data'
import type { ImportSettingsCardProps } from '../types'
import { BackupConfirmation } from './BackupConfirmation'

export function ImportSettingsCard({
	inputRef,
	pending,
	onSelect,
	onCancel,
	onConfirm,
}: ImportSettingsCardProps) {
	return (
		<section aria-label="Import settings" className={BACKUP_SURFACE}>
			<PanelHeader
				icon={Upload}
				title="Import settings"
				description="Load preferences from a JSON backup exported by KesVio."
			/>
			<p className="mt-3 mb-4 text-xs leading-5 text-(--text-muted)">
				The file is checked first; your current preferences are replaced
				only after you confirm.
			</p>
			<div className={BACKUP_ACTIONS}>
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					className={ACTION_BUTTON_NEUTRAL}
				>
					<Upload size={16} aria-hidden="true" />
					Choose backup
				</button>
			</div>
			<input
				ref={inputRef}
				type="file"
				accept="application/json,.json"
				aria-label="Choose settings backup"
				onChange={event => void onSelect(event)}
				className="sr-only"
			/>
			{pending?.kind === 'import' && (
				<BackupConfirmation
					question={`Import ${pending.name}? This replaces your current settings.`}
					confirmLabel="Import backup"
					onCancel={onCancel}
					onConfirm={onConfirm}
				/>
			)}
		</section>
	)
}
