import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { CollapsiblePanel } from '../../../../shared/ui/CollapsiblePanel'

interface FilterDisclosureProps {
	title: string
	selectedCount: number
	children: ReactNode
}

export function FilterDisclosure({
	title,
	selectedCount,
	children,
}: FilterDisclosureProps) {
	const [expanded, setExpanded] = useState(false)
	const contentId = useId()
	const selectionLabel =
		selectedCount === 0 ? 'No selection' : `${selectedCount} selected`

	return (
		<fieldset className="min-w-0 rounded-xl border border-(--border-neutral) bg-(--surface-inset)/45">
			<legend className="sr-only">{title}</legend>
			<button
				type="button"
				aria-expanded={expanded}
				aria-controls={contentId}
				onClick={() => setExpanded(value => !value)}
				className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--accent-strong)"
			>
				<span className="min-w-0 flex-1 text-sm font-semibold">
					{title}
				</span>
				<span className="rounded-full bg-(--surface-raised) px-2 py-0.5 text-xs text-(--text-muted)">
					{selectionLabel}
				</span>
				<ChevronDown
					size={16}
					aria-hidden="true"
					className={`shrink-0 transition-transform duration-(--motion-fast) motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
				/>
			</button>
			<CollapsiblePanel
				open={expanded}
				id={contentId}
				className="px-3 pb-3"
			>
				{children}
			</CollapsiblePanel>
		</fieldset>
	)
}
