import type { ReactNode } from 'react'

interface SectionHeadingProps {
	title: string
	titleId: string
	aside?: ReactNode
}

export function SectionHeading({ title, titleId, aside }: SectionHeadingProps) {
	return (
		<header className="mb-2.5 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:justify-start">
			<h2
				id={titleId}
				className="truncate text-sm font-semibold text-(--text-muted)"
			>
				{title}
			</h2>
			{aside}
		</header>
	)
}
