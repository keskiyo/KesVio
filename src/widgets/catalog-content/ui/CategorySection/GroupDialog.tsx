import { X } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from '../../../../shared/hooks/useModalDialog'
import { useProgressiveList } from '../../../../shared/hooks/useProgressiveList'
import type { PublisherGroupProps } from './types'

export function GroupDialog({
	publisher,
	apps,
	renderApp,
	onClose,
	closing,
}: PublisherGroupProps & { onClose(): void; closing: boolean }) {
	const dialog = useRef<HTMLElement>(null)
	const visible = useProgressiveList(apps)
	const nameCounts = useMemo(() => {
		const counts = new Map<string, number>()
		for (const app of apps) {
			const key = app.name.trim().toLocaleLowerCase()
			counts.set(key, (counts.get(key) ?? 0) + 1)
		}
		return counts
	}, [apps])
	const close = useCallback(() => onClose(), [onClose])
	useModalDialog({ ref: dialog, onDismiss: close })
	return createPortal(
		<div
			className={`publisher-overlay motion-overlay fixed inset-0 z-500 grid place-items-center bg-slate-950/55 p-4 ${closing ? 'is-closing' : ''}`}
			onClick={event => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			<section
				ref={dialog}
				role="dialog"
				aria-modal="true"
				aria-label={publisher}
				className="publisher-panel motion-panel flex max-h-[min(38rem,calc(100vh-2rem))] w-[min(34rem,calc(100vw-2rem))] flex-col rounded-2xl border border-(--border-neutral) bg-(--surface-inset) p-5 text-(--text-primary) shadow-(--shadow-dialog)"
			>
				<header className="mb-4 flex items-center gap-3">
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-lg font-semibold">
							{publisher}
						</h2>
						<p className="text-sm text-(--text-muted)">
							{apps.length} apps
						</p>
					</div>
					<button
						type="button"
						aria-label={`Close ${publisher}`}
						onClick={onClose}
						className="grid size-9 place-items-center rounded-lg text-(--text-muted) focus-visible:outline-2 focus-visible:outline-(--accent-strong)"
					>
						<X size={18} aria-hidden="true" />
					</button>
				</header>
				<div className="min-h-0 overflow-y-auto">
					<div className="app-card-grid">
						{visible.visible.map(app => (
							<div key={app.id} className="min-w-0">
								{renderApp(app)}
								{(nameCounts.get(
									app.name.trim().toLocaleLowerCase(),
								) ?? 0) > 1 && (
									<p
										className="mt-1 truncate text-center text-xs text-(--text-muted)"
										title={app.path}
									>
										{app.path.split(/[\\/]/).at(-1)}
									</p>
								)}
							</div>
						))}
					</div>
					{visible.hasMore && (
						<div
							ref={visible.sentinelRef}
							aria-hidden="true"
							className="h-1"
						/>
					)}
				</div>
			</section>
		</div>,
		document.querySelector('.app-shell') ?? document.body,
	)
}
