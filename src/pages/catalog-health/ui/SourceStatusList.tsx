import { ATTENTION_SURFACE, ATTENTION_TEXT } from '../data'
import type { SourceStatusListProps } from '../types'

export function SourceStatusList({ rows }: SourceStatusListProps) {
	return (
		<ul aria-label="Source status" className="grid gap-2 sm:grid-cols-2">
			{rows.map(row => (
				<li
					key={row.key}
					data-attention={row.needsAttention || undefined}
					className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${row.needsAttention ? ATTENTION_SURFACE : 'border-(--border-neutral) bg-(--surface-inset)'}`}
				>
					<span className="min-w-0 truncate text-(--text-primary)">
						{row.label}
					</span>
					<span
						className={`shrink-0 text-xs font-medium ${row.needsAttention ? ATTENTION_TEXT : 'text-(--text-muted)'}`}
					>
						{row.statusLabel}
					</span>
				</li>
			))}
		</ul>
	)
}
