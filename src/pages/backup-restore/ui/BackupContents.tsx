import { Check, ShieldCheck } from 'lucide-react'
import { PanelHeader } from '../../../shared/ui/PanelHeader'
import { BACKUP_CONTENTS } from '../data'

export function BackupContents() {
	return (
		<section
			aria-label="What a backup holds"
			className="rounded-2xl border border-(--border-neutral) bg-(--surface-panel) p-5"
		>
			<PanelHeader
				icon={ShieldCheck}
				title="What a backup holds"
				description="One small JSON file with your KesVio preferences — not the applications themselves."
			/>
			<ul className="mt-4 flex flex-wrap gap-2">
				{BACKUP_CONTENTS.map(item => (
					<li
						key={item}
						className="inline-flex items-center gap-1.5 rounded-lg border border-(--border-neutral) bg-(--surface-inset) px-2.5 py-1 text-xs font-medium text-(--text-primary)"
					>
						<Check size={13} aria-hidden="true" />
						{item}
					</li>
				))}
			</ul>
			<p className="mt-3 text-xs leading-5 text-(--text-muted)">
				Scan folders, startup and tray behaviour are stored by Windows
				and are not part of the file.
			</p>
		</section>
	)
}
