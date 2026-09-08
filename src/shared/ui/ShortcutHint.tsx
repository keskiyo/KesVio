export interface ShortcutHintProps {
	label: string
	keys: string
	className?: string
}

export function ShortcutHint({
	label,
	keys,
	className = '',
}: ShortcutHintProps) {
	return (
		<p className={`text-xs text-(--text-muted) ${className}`}>
			{label}{' '}
			<kbd className="rounded-md border border-(--border-neutral) bg-(--surface-raised) px-1.5 py-0.5 font-sans text-[0.7rem] font-medium whitespace-nowrap text-(--text-primary)">
				{keys}
			</kbd>
		</p>
	)
}
