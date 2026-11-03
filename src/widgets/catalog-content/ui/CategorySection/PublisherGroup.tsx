import { AppWindow } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GroupDialog } from './GroupDialog'
import { publisherGroupLabel } from './publisherGroups'
import type { PublisherGroupProps } from './types'

export function PublisherGroup({
	publisher,
	apps,
	renderApp,
}: PublisherGroupProps) {
	const [open, setOpen] = useState(false)
	const [closing, setClosing] = useState(false)
	const label = useMemo(
		() => publisherGroupLabel(publisher, apps),
		[publisher, apps],
	)
	const icons = useMemo(
		() =>
			[
				...new Set(
					apps
						.map(app => app.iconBase64)
						.filter((icon): icon is string => Boolean(icon)),
				),
			].slice(0, 4),
		[apps],
	)
	const close = useCallback(() => {
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
			setOpen(false)
		else setClosing(true)
	}, [])
	useEffect(() => {
		if (!closing) return
		const timer = window.setTimeout(() => {
			setOpen(false)
			setClosing(false)
		}, 200)
		return () => window.clearTimeout(timer)
	}, [closing])
	return (
		<>
			<button
				type="button"
				data-launch-target=""
				aria-label={`${label}, ${apps.length} apps`}
				onClick={() => setOpen(true)}
				className="app-card app-card-tile app-card-glass flex flex-col items-center justify-center gap-2 border border-white/85 px-2 text-center focus-visible:outline-2 focus-visible:outline-(--accent-strong)"
			>
				<span
					aria-hidden="true"
					className={`publisher-preview relative grid size-12 shrink-0 place-items-center rounded-xl p-1.5 ${icons.length > 1 ? 'grid-cols-2 grid-rows-2 gap-1' : ''}`}
				>
					{icons.length ? (
						icons.map(icon => (
							<img
								key={icon}
								src={icon}
								alt=""
								className="size-full object-contain"
								draggable={false}
							/>
						))
					) : (
						<AppWindow size={24} aria-hidden="true" />
					)}
					<span className="publisher-stack-mark" />
				</span>
				<span className="app-card-name publisher-group-name w-full font-medium">
					{label}
				</span>
			</button>
			{open && (
				<GroupDialog
					publisher={label}
					apps={apps}
					closing={closing}
					renderApp={renderApp}
					onClose={close}
				/>
			)}
		</>
	)
}
