import { ChevronDown } from 'lucide-react'
import { keepFocusNearRemovedItem } from '../../../../shared/lib/focus'
import type { RowActionProps, VersionToggleProps } from './types'

const ROW_ACTION =
	'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong) motion-reduce:transition-none'

export function RowAction({
	icon: Icon,
	label,
	accessibleLabel,
	onClick,
}: RowActionProps) {
	return (
		<button
			type="button"
			aria-label={accessibleLabel}
			onClick={event => {
				keepFocusNearRemovedItem(event.currentTarget.closest('article'))
				onClick()
			}}
			className={`${ROW_ACTION} border-(--accent)/55 bg-(--utility-accent) text-(--text-primary) hover:bg-(--utility-accent-hover)`}
		>
			<Icon size={14} aria-hidden="true" />
			{label}
		</button>
	)
}

export function VersionToggle({
	appName,
	olderCount,
	expanded,
	onToggle,
}: VersionToggleProps) {
	const noun = olderCount === 1 ? 'version' : 'versions'
	return (
		<button
			type="button"
			aria-expanded={expanded}
			aria-label={`${expanded ? 'Hide' : 'Show'} ${olderCount} older ${noun} of ${appName}`}
			onClick={onToggle}
			className={`${ROW_ACTION} border-(--border-neutral) bg-(--surface-inset) text-(--text-muted) hover:text-(--text-primary)`}
		>
			+{olderCount}
			<ChevronDown
				size={14}
				aria-hidden="true"
				className={`transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
			/>
		</button>
	)
}
