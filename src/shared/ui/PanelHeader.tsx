import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PanelHeaderProps {
	icon: LucideIcon
	title: string
	description: ReactNode
}

export function PanelHeader({
	icon: Icon,
	title,
	description,
}: PanelHeaderProps) {
	return (
		<div className="flex items-start gap-4">
			<span className="grid size-10 shrink-0 place-items-center rounded-xl border border-(--border-neutral) bg-(--surface-raised)">
				<Icon size={19} aria-hidden="true" />
			</span>
			<div className="min-w-0 flex-1">
				<h2 className="font-medium text-(--text-primary)">{title}</h2>
				<p className="mt-1 text-sm leading-6 text-(--text-muted)">
					{description}
				</p>
			</div>
		</div>
	)
}
