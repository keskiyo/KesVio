import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { EllipsisVertical } from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'
import { useIsLaunching } from '../../../../features/launch-app'
import { AppActionsMenu } from '../../../../features/app-actions'
import { CardIcon, isCatalogArtifact } from '../../../../entities/app'
import { middleEllipsis } from '../../../../shared/lib/text'
import { rowMenuButtonClass } from './data'
import type { AppRowProps } from './types'

const LOCATION_MAX_CHARS = 64

function ignoreHide() {}

function AppRowComponent({
	app,
	categories,
	categoryOrder,
	isHidden,
	onLaunch,
	onMove,
	onInfo,
	onOpenFolder,
	onManageInWindows,
	onHide = ignoreHide,
	onRestore,
	onDemote,
}: AppRowProps) {
	const [menuOpen, setMenuOpen] = useState(false)
	const launching = useIsLaunching(app.id)
	const manageRef = useRef<HTMLButtonElement | null>(null)
	const closeMenu = useCallback(() => {
		setMenuOpen(false)
		manageRef.current?.focus()
	}, [])
	const artifact = isCatalogArtifact(app)
	const draggable = useDraggable({
		id: `app:${app.id}`,
		data: { type: 'app', appId: app.id, category: app.category },
		disabled: artifact,
	})
	const metadata = [app.publisher?.trim(), app.version?.trim()]
		.filter(Boolean)
		.join(' · ')
	const location = artifact ? app.path.trim() : ''

	return (
		<article
			ref={draggable.setNodeRef}
			data-menu-open={menuOpen || undefined}
			data-launching={launching || undefined}
			style={{ transform: CSS.Translate.toString(draggable.transform) }}
			className={`app-card app-card-row group relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-xl border border-(--border-neutral) bg-(--surface-panel) transition-[border-color,background-color,opacity] duration-200 ease-out focus-within:border-(--accent)/60 hover:border-(--accent)/60 hover:bg-(--surface-raised) data-[menu-open]:border-(--accent)/60 data-[menu-open]:bg-(--surface-raised) motion-reduce:transition-none ${menuOpen ? 'z-100' : ''} ${draggable.isDragging ? 'z-40 opacity-60' : ''}`}
		>
			<button
				type="button"
				onClick={() => {
					if (!launching) void onLaunch(app)
				}}
				aria-label={`Launch ${app.name}`}
				aria-busy={launching}
				disabled={launching}
				title={launching ? 'Launching…' : app.name}
				className="relative z-1 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-l-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-(--accent-strong) disabled:cursor-progress"
			>
				<CardIcon
					iconBase64={app.iconBase64}
					launching={launching}
					tone="neutral"
				/>
				<span className="min-w-0">
					<span className="line-clamp-2 text-sm leading-5 font-semibold break-words text-(--text-primary)">
						{app.name}
					</span>
					{metadata && (
						<span
							className="mt-0.5 block truncate text-xs leading-4 text-(--text-muted)"
							title={metadata}
						>
							{metadata}
						</span>
					)}
					{location && (
						<span
							className="mt-1 block truncate font-mono text-[11px] leading-4 text-(--text-subtle)"
							title={location}
						>
							{middleEllipsis(location, LOCATION_MAX_CHARS)}
						</span>
					)}
				</span>
			</button>
			<span className="relative z-2 mr-2 flex items-center self-center">
				<button
					type="button"
					ref={node => {
						draggable.setActivatorNodeRef(node)
						manageRef.current = node
					}}
					{...draggable.listeners}
					{...draggable.attributes}
					aria-label={`Manage ${app.name}`}
					aria-expanded={menuOpen}
					aria-haspopup="menu"
					onClick={event => {
						event.stopPropagation()
						setMenuOpen(value => !value)
					}}
					className={`${rowMenuButtonClass(menuOpen)} ${artifact ? '' : 'cursor-grab active:cursor-grabbing'}`}
				>
					<EllipsisVertical size={16} aria-hidden="true" />
				</button>
			</span>
			{menuOpen && (
				<AppActionsMenu
					app={app}
					categories={categories}
					categoryOrder={categoryOrder}
					onClose={closeMenu}
					onMove={onMove}
					onInfo={onInfo}
					onOpenFolder={onOpenFolder}
					onManageInWindows={onManageInWindows}
					isHidden={isHidden}
					isUserPromoted={app.userPromoted}
					onHide={onHide}
					onRestore={onRestore}
					onDemote={onDemote}
					anchorRef={manageRef}
				/>
			)}
		</article>
	)
}

export const AppRow = memo(AppRowComponent)
