import type { ReactNode } from 'react'

interface Props {
	title: string
	description?: ReactNode
	children: ReactNode
}

export function ShortcutRow({ title, description, children }: Props) {
	return (
		<div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-(--border-neutral) px-5 py-3 last:border-b-0">
			<dt className="min-w-0 text-sm font-medium">{title}</dt>
			<dd className="min-w-0">{children}</dd>
			{description && (
				<dd className="w-full text-sm leading-6 text-(--text-muted)">
					{description}
				</dd>
			)}
		</div>
	)
}
