import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from '../../../../shared/hooks/useModalDialog'
import { useScenarioImport } from '../../model/useScenarioImport'
import { ScenarioImportRows } from './ScenarioImportRows'
import type { ScenarioImportDialogProps } from './types'

export function ScenarioImportDialog({
	client,
	existing,
	disabled,
	onClose,
}: ScenarioImportDialogProps) {
	const dialog = useRef<HTMLElement>(null)
	const input = useRef<HTMLInputElement>(null)
	const model = useScenarioImport(client, onClose)
	useModalDialog({ ref: dialog, initialFocusRef: input, onDismiss: onClose })
	return createPortal(
		<div className="motion-overlay fixed inset-0 z-500 grid place-items-center bg-slate-700/40 p-4 backdrop-blur-[2px]">
			<section
				ref={dialog}
				role="dialog"
				aria-modal="true"
				aria-labelledby="scenario-import-title"
				className="motion-panel flex max-h-[calc(100vh-2rem)] w-[min(36rem,calc(100vw-2rem))] flex-col gap-4 rounded-2xl border border-(--border-neutral) bg-(--surface-panel) p-5 text-(--text-primary) shadow-(--shadow-dialog)"
			>
				<h2
					id="scenario-import-title"
					className="text-base font-semibold"
				>
					Import scenarios
				</h2>
				<p className="text-sm text-(--text-muted)">
					Choose scenarios from a KesVio backup. Copies get new names
					when needed. Replacement keeps the local name and favorite
					status. Nothing runs during import.
				</p>
				<label className="grid gap-2 text-sm">
					Backup file (up to 1 MB)
					<input
						ref={input}
						type="file"
						accept=".json,application/json"
						disabled={disabled}
						onChange={event => {
							void model.read(event.target.files?.[0])
							event.target.value = ''
						}}
					/>
				</label>
				<div className="min-h-0 overflow-y-auto">
					{model.reading && <p role="status">Reading backup…</p>}
					{model.draft && !model.draft.scenarios.length && (
						<p role="status">This backup contains no scenarios.</p>
					)}
					{model.draft && (
						<ScenarioImportRows
							incoming={model.draft.scenarios}
							existing={existing}
							choices={model.choices}
							disabled={disabled}
							onSelect={model.select}
							onReplace={model.replace}
						/>
					)}
				</div>
				{model.error && (
					<p role="alert" className="text-sm text-(--category-red)">
						{model.error}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-(--border-neutral) px-4 py-2 text-sm"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={
							disabled || model.reading || !model.choices.length
						}
						onClick={model.apply}
						className="utility-accent-button rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50"
					>
						Import selected ({model.choices.length})
					</button>
				</div>
			</section>
		</div>,
		document.body,
	)
}
