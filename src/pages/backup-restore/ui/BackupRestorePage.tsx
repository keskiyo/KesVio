import { DatabaseBackup } from 'lucide-react'
import { CatalogViewHeader } from '../../../widgets/catalog-content'
import { usePreferencesBackup } from '../model/usePreferencesBackup'
import type { BackupRestorePageProps } from '../types'
import { BackupContents } from './BackupContents'
import { ExportSettingsCard } from './ExportSettingsCard'
import { RecoverySettingsCard } from './RecoverySettingsCard/RecoverySettingsCard'

export function BackupRestorePage({
	onBack,
	...actions
}: BackupRestorePageProps) {
	const backup = usePreferencesBackup(actions)
	return (
		<section
			aria-labelledby="backup-restore-title"
			className="mx-auto w-full max-w-4xl"
		>
			<CatalogViewHeader
				icon={DatabaseBackup}
				title="Backup & Restore"
				titleId="backup-restore-title"
				description="Protect, move or recover your KesVio preferences."
				back={{ label: 'Back to More', onBack }}
			/>
			<BackupContents />
			<div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
				<ExportSettingsCard
					exporting={backup.exporting}
					onExport={backup.exportSettings}
				/>
				<RecoverySettingsCard
					inputRef={backup.inputRef}
					pending={backup.pending}
					localBackupAvailable={backup.localBackupAvailable}
					onSelect={backup.selectImport}
					onRequestRestore={backup.requestRestore}
					onCancel={backup.cancelPending}
					onConfirm={backup.confirmPending}
				/>
			</div>
			{backup.message && (
				<p
					role="status"
					className="mt-4 rounded-xl border border-(--category-green)/35 bg-(--category-green)/8 px-4 py-2.5 text-sm text-(--category-green)"
				>
					{backup.message}
				</p>
			)}
			{backup.error && (
				<p
					role="alert"
					className="mt-4 rounded-xl border border-(--category-red)/40 bg-(--category-red)/8 px-4 py-2.5 text-sm text-(--category-red)"
				>
					{backup.error}
				</p>
			)}
		</section>
	)
}
