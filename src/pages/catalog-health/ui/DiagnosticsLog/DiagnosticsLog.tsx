import { FileDown, ScrollText } from 'lucide-react'
import { useState } from 'react'
import {
	ACTION_BUTTON_NEUTRAL,
	ACTION_ROW,
} from '../../../../shared/ui/buttonVariants'
import { ADVANCED_SURFACE } from '../../data'
import type { DiagnosticsLogProps } from '../../types'
import { useDiagnosticsPreview } from './useDiagnosticsPreview'

export function DiagnosticsLog({ onExport, onPreview }: DiagnosticsLogProps) {
	const preview = useDiagnosticsPreview(onPreview)
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
		<section aria-label="Diagnostics log" className={ADVANCED_SURFACE}>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<ScrollText size={18} aria-hidden="true" className="shrink-0" />
				<div className="min-w-0 flex-1 basis-56">
					<h2 className="text-sm font-medium text-(--text-primary)">
						Diagnostics log
					</h2>
					<p className="mt-0.5 text-xs leading-5 text-(--text-muted)">
						Recent scan steps with paths, accounts and machine names
						replaced by placeholders. Preview what would be shared,
						or export it as XML.
					</p>
				</div>
				<div className={`${ACTION_ROW} w-full sm:w-auto`}>
					<button
						type="button"
						disabled={preview.loading || exporting}
						onClick={() => void preview.show()}
						className={ACTION_BUTTON_NEUTRAL}
					>
						{preview.loading
							? 'Loading preview…'
							: 'Preview redacted log'}
					</button>
					<button
						type="button"
						disabled={exporting}
						onClick={() => void save()}
						className={ACTION_BUTTON_NEUTRAL}
					>
						<FileDown size={16} aria-hidden="true" />
						{exporting ? 'Saving…' : 'Export log as XML'}
					</button>
				</div>
			</div>
			<p
				aria-live="polite"
				className={`text-sm leading-6 text-(--text-muted) ${message ? 'mt-2' : 'h-0 overflow-hidden'}`}
			>
				{message}
			</p>
			{preview.error && (
				<p role="alert" className="text-sm text-(--category-red)">
					{preview.error}
				</p>
			)}
			{preview.text !== null && (
				<pre
					role="region"
					aria-label="Redacted diagnostics preview"
					tabIndex={0}
					className="mt-3 max-h-64 overflow-auto rounded-xl border border-(--border-neutral) bg-(--surface-inset) p-3 text-xs break-all whitespace-pre-wrap"
				>
					{preview.text}
				</pre>
			)}
		</section>
	)
}
