import { FileDown, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { SettingsSectionHeader } from '../components/SettingsSectionHeader'
import { ACTION_BUTTON, ACTION_ROW } from '../../data'
import type { DiagnosticsLogExportProps } from '../../types'

const NEUTRAL_BUTTON =
	'border border-slate-300 bg-slate-100 text-slate-700 hover:border-violet-400/45 hover:bg-violet-100/75 focus-visible:outline-violet-500'

export function DiagnosticsLogExport({ onExport }: DiagnosticsLogExportProps) {
	const [exporting, setExporting] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	async function save() {
		setExporting(true)
		setMessage(null)
		try {
			const saved = await onExport()
			if (saved) setMessage('Diagnostics log exported.')
		} catch {
			setMessage('Could not save the diagnostics log.')
		} finally {
			setExporting(false)
		}
	}

	return (
		<section className="settings-surface flex flex-col rounded-2xl border border-white/85 bg-white/58 p-5">
			<div className="flex items-start gap-4">
				<SettingsSectionHeader
					icon={ScrollText}
					title="Diagnostics log"
					description="Export recent scan logs."
				/>
			</div>
			<div className={`mt-auto pt-4 ${ACTION_ROW}`}>
				<button
					type="button"
					disabled={exporting}
					onClick={() => void save()}
					className={`${ACTION_BUTTON} ${NEUTRAL_BUTTON}`}
				>
					<FileDown size={16} aria-hidden="true" />
					{exporting ? 'Saving…' : 'Export log as XML'}
				</button>
			</div>
			<p className="mt-3 text-sm leading-6 text-slate-600">
				The log names the folders a scan walked, so read it before
				sharing it.
			</p>
			<p
				aria-live="polite"
				className="mt-1 text-sm leading-6 text-slate-600"
			>
				{message}
			</p>
		</section>
	)
}
