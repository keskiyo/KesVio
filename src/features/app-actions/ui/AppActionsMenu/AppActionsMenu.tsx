import { ArrowRight, ExternalLink, Info } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { driveCategoryFor } from '../../../../entities/category'
import { createPortal } from 'react-dom'
import {
	INSTALLERS_DOCS_CATEGORY,
	isCatalogArtifact,
} from '../../../../entities/app'
import { CategorySubmenu } from './CategorySubmenu'
import { MENU_PANEL } from './data'
import { FileActionItems } from './FileActionItems'
import { MenuItem } from './MenuItem'
import { PlacementItem } from './PlacementItem'
import type { AppActionsMenuProps } from './types'
import { useActionsMenu } from '../../model/useActionsMenu'

export function AppActionsMenu({
	app,
	categories,
	categoryOrder,
	onClose,
	onMove,
	onInfo,
	onManageInWindows,
	fileActions,
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
				className={MENU_PANEL}
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
							className="mx-1 my-0.5 border-t border-slate-200/55 sm:my-1"
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
				{!filedArtifact && (
					<FileActionItems
						app={app}
						isHidden={isHidden}
						fileActions={fileActions}
						onClose={onClose}
					/>
				)}
				{drive && (
					<p className="px-2.5 py-1.5 text-[11px] text-(--text-muted) sm:px-3 sm:py-2 sm:text-xs">
						Grouped by scan drive. Category changes are unavailable.
					</p>
				)}
				<PlacementItem
					app={app}
					isHidden={isHidden}
					isUserPromoted={isUserPromoted}
					onHide={onHide}
					onRestore={onRestore}
					onDemote={onDemote}
					onClose={onClose}
				/>
				{!isHidden && !filedArtifact && (
					<div className="mx-1 my-0.5 border-t border-slate-200/55 sm:my-1" />
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
