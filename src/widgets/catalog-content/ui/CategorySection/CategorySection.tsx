import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CatalogAppCard } from '../CatalogAppCard/CatalogAppCard'
import { CategoryNameEditor } from '../../../../features/manage-category'
import { useProgressiveList } from '../../../../shared/hooks/useProgressiveList'
import { DANGER_ICON_BUTTON } from '../../../../shared/ui/buttonVariants'
import { CollapsiblePanel } from '../../../../shared/ui/CollapsiblePanel'
import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog'
import { CategoryHeader } from './CategoryHeader'
import type { CategorySectionProps } from './types'

export function CategorySection({
	category,
	definition,
	categories,
	categoryOrder,
	apps,
	collapsed,
	favoriteIds,
	onToggle,
	onToggleFavorite,
	onLaunch,
	onMoveApp,
	onInfo,
	onUninstall,
	onHide,
	onRestore,
	onDemote,
	onRenameCategory,
	onDeleteCategory,
}: CategorySectionProps) {
	const label = definition.label
	const [editing, setEditing] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const cards = useProgressiveList(apps)
	return (
		<section
			aria-labelledby={`category-${category}`}
			data-category={category}
			className="relative scroll-mt-40 rounded-2xl transition-colors duration-200 focus-within:z-90 lg:scroll-mt-24"
		>
			<div className="mb-3 flex items-center gap-2">
				{editing ? (
					<CategoryNameEditor
						initialValue={label}
						label={`Rename ${label} category`}
						onCancel={() => setEditing(false)}
						onSave={value => {
							const result = onRenameCategory(category, value)
							if (result.ok) setEditing(false)
							return result.ok ? null : result.error
						}}
					/>
				) : (
					<CategoryHeader
						category={category}
						label={label}
						appCount={apps.length}
						collapsed={collapsed}
						onToggle={onToggle}
						onEdit={() => setEditing(true)}
					/>
				)}
				{!definition.builtIn && !editing && (
					<button
						type="button"
						aria-label={`Delete ${label} category`}
						onClick={() => setDeleting(true)}
						className={DANGER_ICON_BUTTON}
					>
						<Trash2 size={15} aria-hidden="true" />
					</button>
				)}
			</div>
			<CollapsiblePanel open={!collapsed}>
				<div>
					<div className="app-card-grid">
						{cards.visible.map(app => (
							<CatalogAppCard
								key={app.id}
								app={app}
								isFavorite={favoriteIds.has(app.id)}
								categories={categories}
								categoryOrder={categoryOrder}
								onToggleFavorite={onToggleFavorite}
								onLaunch={onLaunch}
								onMove={onMoveApp}
								onInfo={onInfo}
								onUninstall={onUninstall}
								onHide={onHide}
								onRestore={onRestore}
								onDemote={onDemote}
							/>
						))}
					</div>
					{cards.hasMore && (
						<div
							ref={cards.sentinelRef}
							aria-hidden="true"
							className="h-1"
						/>
					)}
				</div>
			</CollapsiblePanel>
			{deleting && (
				<ConfirmDialog
					label={`Delete ${label} category`}
					title={`Delete ${label}?`}
					description="Applications in this category will return to their detected category."
					confirmLabel="Delete category"
					closeLabel="Close category deletion"
					onClose={() => setDeleting(false)}
					onConfirm={() => {
						onDeleteCategory(category)
						setDeleting(false)
					}}
				/>
			)}
		</section>
	)
}
