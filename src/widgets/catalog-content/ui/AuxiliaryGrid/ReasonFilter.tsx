import { visibilityReasonLabel } from '../../../../entities/app'
import type { ReasonFilterProps } from './types'

const CHIP =
	'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong) motion-reduce:transition-none'

export function ReasonFilter({
	options,
	total,
	selected,
	onSelect,
}: ReasonFilterProps) {
	if (options.length < 2) return null
	const chip = (active: boolean) =>
		`${CHIP} ${active ? 'border-(--accent) bg-(--utility-accent) text-(--text-primary)' : 'border-(--border-neutral) bg-(--surface-panel) text-(--text-muted) hover:text-(--text-primary)'}`
	return (
		<>
			<label className="mb-3 flex items-center gap-2 text-xs text-(--text-muted) sm:hidden">
				Reason
				<select
					value={selected ?? ''}
					onChange={event =>
						onSelect(
							options.find(
								option => option.reason === event.target.value,
							)?.reason ?? null,
						)
					}
					className="h-9 min-w-0 flex-1 rounded-lg border border-(--border-neutral) bg-(--surface-panel) px-2 text-sm text-(--text-primary)"
				>
					<option value="">All reasons ({total})</option>
					{options.map(({ reason, count }) => (
						<option key={reason} value={reason}>
							{visibilityReasonLabel(reason)} ({count})
						</option>
					))}
				</select>
			</label>
			<div
				role="group"
				aria-label="Filter auxiliary tools by reason"
				className="mb-3 hidden flex-wrap gap-1.5 sm:flex"
			>
				<button
					type="button"
					aria-pressed={selected === null}
					onClick={() => onSelect(null)}
					className={chip(selected === null)}
				>
					All <span className="tabular-nums opacity-70">{total}</span>
				</button>
				{options.map(({ reason, count }) => (
					<button
						key={reason}
						type="button"
						aria-pressed={selected === reason}
						onClick={() => onSelect(reason)}
						className={chip(selected === reason)}
					>
						{visibilityReasonLabel(reason)}
						<span className="tabular-nums opacity-70">{count}</span>
					</button>
				))}
			</div>
		</>
	)
}
