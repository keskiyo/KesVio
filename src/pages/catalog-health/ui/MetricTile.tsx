import { ATTENTION_TEXT } from '../data'
import type { MetricTileProps } from '../types'

export function MetricTile({ label, value, attention }: MetricTileProps) {
	return (
		<div className="min-w-0 rounded-xl border border-(--border-neutral) bg-(--surface-inset) px-3 py-2.5">
			<dt className="text-xs text-(--text-muted)">{label}</dt>
			<dd
				className={`mt-0.5 text-base leading-snug font-semibold break-words tabular-nums ${attention ? ATTENTION_TEXT : 'text-(--text-primary)'}`}
			>
				{value}
			</dd>
		</div>
	)
}
