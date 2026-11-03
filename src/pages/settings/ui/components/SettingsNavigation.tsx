import type { MouseEvent } from 'react'

interface Props {
	maintenance: boolean
}

export function SettingsNavigation({ maintenance }: Props) {
	const sections = [
		['general', 'General'],
		['shortcuts', 'Keyboard shortcuts'],
		['catalog', 'Catalog'],
		...(maintenance ? [['maintenance', 'Maintenance']] : []),
	]
	function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
		const target = document.getElementById(`settings-${id}`)
		if (!target) return
		event.preventDefault()
		target.focus({ preventScroll: true })
		const viewport = target.closest<HTMLElement>('#catalog-scroll')
		if (!viewport) return
		const reducedMotion = window.matchMedia?.(
			'(prefers-reduced-motion: reduce)',
		).matches
		viewport.scrollTo({
			top:
				viewport.scrollTop +
				target.getBoundingClientRect().top -
				viewport.getBoundingClientRect().top,
			behavior: reducedMotion ? 'instant' : 'smooth',
		})
	}
	return (
		<nav
			aria-label="Settings sections"
			className="mb-6 flex flex-wrap gap-x-1 gap-y-1 border-b border-(--border-neutral) pb-3"
		>
			{sections.map(([id, label]) => (
				<a
					key={id}
					href={`#settings-${id}`}
					onClick={event => navigate(event, id!)}
					className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm text-(--text-muted) underline-offset-4 hover:bg-(--surface-raised) hover:text-(--text-primary) hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
				>
					{label}
				</a>
			))}
		</nav>
	)
}
