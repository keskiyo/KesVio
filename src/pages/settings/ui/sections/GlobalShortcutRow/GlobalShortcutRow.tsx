import type { FocusEvent } from 'react'
import { Pencil, RotateCcw, X } from 'lucide-react'
import { ACTION_BUTTON } from '../../../../../shared/ui/buttonVariants'
import { ShortcutRow } from '../../components/ShortcutRow'
import { DEFAULT_BINDING, DEFAULT_LABEL } from './data'
import { ShortcutConfirmDialog } from './ShortcutConfirmDialog'
import { ShortcutDescription } from './ShortcutDescription'
import { useShortcutRecorder } from './useShortcutRecorder'
import type { GlobalShortcutRowProps } from '../../../types'

export function GlobalShortcutRow({
	shortcut,
	saving,
	error,
	onSetGlobalShortcut,
}: GlobalShortcutRowProps) {
	const recorder = useShortcutRecorder(onSetGlobalShortcut)
	const label = shortcut?.label ?? DEFAULT_LABEL
	function handleBlur(event: FocusEvent<HTMLDivElement>) {
		if (!recorder.recording || !document.hasFocus()) return
		const next = event.relatedTarget
		if (next instanceof Node && event.currentTarget.contains(next)) return
		recorder.stop()
	}
	return (
		<ShortcutRow
			title="Show KesVio"
			description={
				<ShortcutDescription
					recording={recorder.recording}
					problem={recorder.problem}
					error={error}
					attempt={recorder.attempt}
				/>
			}
		>
			<div
				role="group"
				aria-label="Global shortcut"
				onBlur={handleBlur}
				className="flex max-w-full overflow-hidden rounded-lg border border-(--border-neutral) bg-(--surface-inset)"
			>
				<kbd className="flex min-w-0 flex-1 items-center justify-center truncate px-2.5 py-2 font-mono text-xs font-medium text-(--text-primary)">
					{recorder.recording ? 'Press keys' : label}
				</kbd>
				<button
					type="button"
					aria-label={
						recorder.recording
							? 'Cancel shortcut change'
							: `Change global shortcut, currently ${label}`
					}
					disabled={saving}
					onClick={
						recorder.recording ? recorder.stop : recorder.start
					}
					className={`${ACTION_BUTTON} !rounded-none border-l border-(--border-neutral) px-2.5 text-(--text-primary) hover:bg-(--surface-raised) focus-visible:-outline-offset-2! focus-visible:outline-violet-500`}
				>
					{recorder.recording ? (
						<X size={16} aria-hidden="true" />
					) : (
						<Pencil size={16} aria-hidden="true" />
					)}
					{recorder.recording ? 'Cancel' : 'Change'}
				</button>
				{!recorder.recording && label !== DEFAULT_LABEL && (
					<button
						type="button"
						aria-label="Restore default shortcut"
						title="Restore default shortcut"
						disabled={saving}
						onClick={() =>
							void onSetGlobalShortcut(DEFAULT_BINDING)
						}
						className={`${ACTION_BUTTON} !rounded-none border-l border-(--border-neutral) px-3 text-(--text-muted) hover:bg-(--surface-raised) focus-visible:-outline-offset-2! focus-visible:outline-violet-500`}
					>
						<RotateCcw size={16} aria-hidden="true" />
					</button>
				)}
			</div>
			{recorder.candidate && (
				<ShortcutConfirmDialog
					candidate={recorder.candidate}
					current={label}
					onConfirm={recorder.confirm}
					onClose={recorder.dismiss}
				/>
			)}
		</ShortcutRow>
	)
}
