import {
	Ban,
	CircleCheck,
	Keyboard,
	type LucideIcon,
	Undo2,
} from 'lucide-react'
import { ConfirmDialog } from '../../../../../shared/ui/ConfirmDialog'
import { describeChange } from './confirmation'
import type { ChangeRow, ShortcutConfirmDialogProps } from './types'

const TONE_ICONS: Record<ChangeRow['tone'], LucideIcon> = {
	gain: CircleCheck,
	loss: Ban,
	freed: Undo2,
}

export function ShortcutConfirmDialog({
	candidate,
	current,
	onConfirm,
	onClose,
}: ShortcutConfirmDialogProps) {
	const change = describeChange(candidate, current)
	return (
		<ConfirmDialog
			tone={change.risky ? 'danger' : 'calm'}
			label="Confirm shortcut"
			title={`Use ${change.keys} to open KesVio?`}
			description={change.note}
			confirmLabel={`Use ${change.keys}`}
			confirmIcon={Keyboard}
			closeLabel="Close shortcut confirmation"
			onConfirm={onConfirm}
			onClose={onClose}
		>
			<ul aria-label="What changes" className="grid gap-3 text-sm">
				{change.rows.map(row => {
					const Icon = TONE_ICONS[row.tone]
					return (
						<li key={row.tone} className="flex items-start gap-2.5">
							<Icon
								size={18}
								aria-hidden="true"
								className="mt-0.5 shrink-0"
							/>
							<span
								className={`min-w-0 leading-6 break-words ${row.tone === 'loss' ? 'font-semibold' : ''}`}
							>
								<kbd className="rounded-md border border-(--border-neutral) bg-(--surface-panel) px-1.5 py-0.5 font-mono text-xs text-(--text-primary)">
									{row.keys}
								</kbd>{' '}
								{row.text}
							</span>
						</li>
					)
				})}
			</ul>
		</ConfirmDialog>
	)
}
