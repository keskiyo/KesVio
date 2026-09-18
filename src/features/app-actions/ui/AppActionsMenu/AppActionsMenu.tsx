import {
	ArrowRight,
	ExternalLink,
	EyeOff,
	FolderOpen,
	Info,
	RotateCcw,
	Wrench,
} from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { driveCategoryFor } from '../../../../entities/category'
import { createPortal } from 'react-dom'
import {
	INSTALLERS_DOCS_CATEGORY,
	isCatalogArtifact,
} from '../../../../entities/app'
import { CategorySubmenu } from './CategorySubmenu'
import { MenuItem } from './MenuItem'
import type { AppActionsMenuProps } from './types'
import { useActionsMenu } from '../../model/useActionsMenu'

export function AppActionsMenu({
	app,
	categories,
	categoryOrder,
	onClose,
	onMove,
	onInfo,
	onOpenFolder,
	onManageInWindows,
	isHidden = false,
	isUserPromoted = false,
	onHide,
	onRestore,
	onDemote,
	anchorRef,
}: AppActionsMenuProps) {
	const [showCategories, setShowCategories] = useState(false)
	const [showArtifacts, setShowArtifacts] = useState(false)
	const filedArtifact = isCatalogArtifact(app)
	const artifact = filedArtifact && !app.userPlacedArtifact
	const drive = driveCategoryFor(app)
	const {
		menuRef,
		categoryMenuRef,
		position,
		categoryPosition,
		onMenuKeyDown,
	} = useActionsMenu({
		anchorRef,
		onClose,
		showCategories,
		branchExpanded: showArtifacts,
	})
	return createPortal(
		<>
			<div
				ref={menuRef}
				onKeyDown={onMenuKeyDown}
				style={
					{
						left: position.left,
						top: position.top,
						'--spotlight-opacity': 0,
					} as CSSProperties
				}
				role="menu"
				aria-label={`${app.name} actions`}
				className="motion-panel fixed z-[600] flex max-h-[calc(100vh-1.5rem)] w-56 max-w-[calc(100vw-1.5rem)] flex-col gap-0.5 overflow-y-auto rounded-xl border border-slate-200/85 bg-slate-50 p-2 text-left text-slate-700 shadow-(--shadow-menu)"
			>
				{!isHidden && !artifact && !drive && (
					<>
						<MenuItem
							trailingIcon={ArrowRight}
							label="Move to category"
							onClick={() => {
								setShowCategories(value => !value)
								setShowArtifacts(false)
							}}
						/>
						<div
							role="separator"
							className="mx-1 my-1 border-t border-slate-200/55"
						/>
					</>
				)}
				<MenuItem
					icon={Info}
					label="App info"
					onClick={() => {
						onClose()
						onInfo(app)
					}}
				/>
				{drive && (
					<p className="px-3 py-2 text-xs text-(--text-muted)">
						Grouped by scan drive. Category changes are unavailable.
					</p>
				)}
				<MenuItem
					icon={
						isHidden ? RotateCcw : isUserPromoted ? Wrench : EyeOff
					}
					label={
						isHidden ? (
							'Restore to catalog'
						) : isUserPromoted ? (
							<>
								<span aria-hidden="true">Move back</span>
								<span className="sr-only">
									Move back to Auxiliary tools
								</span>
							</>
						) : (
							'Hide from catalog'
						)
					}
					onClick={() => {
						if (isHidden) onRestore(app.id)
						else if (isUserPromoted) onDemote(app.id)
						else onHide(app.id)
						onClose()
					}}
				/>
				{!isHidden && (
					<div className="mx-1 my-1 border-t border-slate-200/55" />
				)}
				{!isHidden && filedArtifact && onOpenFolder && (
					<MenuItem
						icon={FolderOpen}
						label="Open folder"
						onClick={() => {
							void onOpenFolder(app)
							onClose()
						}}
					/>
				)}
				{!isHidden && !filedArtifact && app.canUninstall && (
					<MenuItem
						icon={ExternalLink}
						withSpotlight={false}
						label="Uninstall"
						onClick={() => {
							void onManageInWindows()
							onClose()
						}}
					/>
				)}
				{!isHidden && !filedArtifact && !app.canUninstall && (
					<MenuItem
						icon={ExternalLink}
						disabled
						withSpotlight={false}
						label="Uninstall unavailable"
					/>
				)}
			</div>
			{!isHidden && !artifact && !drive && showCategories && (
				<CategorySubmenu
					categories={categories}
					categoryOrder={categoryOrder}
					activeCategory={app.category}
					expandedCategory={
						showArtifacts ? INSTALLERS_DOCS_CATEGORY : null
					}
					menuRef={categoryMenuRef}
					position={categoryPosition}
					onKeyDown={onMenuKeyDown}
					label={`Move ${app.name} to category`}
					onExpand={() => setShowArtifacts(value => !value)}
					onSelect={category => {
						onMove(app.id, category)
						onClose()
					}}
					onSelectArtifact={kind => {
						onMove(app.id, INSTALLERS_DOCS_CATEGORY, kind)
						onClose()
					}}
				/>
			)}
		</>,
		document.querySelector<HTMLElement>('.app-shell') ?? document.body,
	)
}
