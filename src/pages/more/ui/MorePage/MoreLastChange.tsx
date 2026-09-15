import { Undo2 } from 'lucide-react'
import type { MoreLastChangeProps } from './types'

export function MoreLastChange({ lastChange }: MoreLastChangeProps) {
	return (
		<section
			aria-labelledby="more-last-change"
			className="mb-6 flex items-center gap-4 rounded-2xl border border-(--border-neutral) bg-(--surface-panel) px-5 py-4 shadow-(--shadow-summary)"
		>
			<span className="grid size-12 shrink-0 place-items-center rounded-xl border border-(--border-neutral) bg-(--surface-raised)">
				<Undo2 size={22} aria-hidden="true" />
			</span>
			<span className="min-w-0 flex-1">
				<h2
					id="more-last-change"
					className="text-xs font-semibold tracking-wide text-(--text-muted) uppercase"
				>
					Last change
				</h2>
				<span className="mt-1 block truncate text-sm text-(--text-primary)">
					{lastChange.label}
				</span>
			</span>
			<button
				type="button"
				onClick={lastChange.onUndo}
				className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-(--border-neutral) px-3 text-sm font-medium transition-colors hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
			>
				Undo
			</button>
		</section>
	)
}
