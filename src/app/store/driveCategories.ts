import {
	type AppCategory,
	type CategoryDefinition,
	driveCategoryFor,
	isDriveCategory,
	isDefaultDriveLabel,
	stableCustomCategoryAccent,
} from '../../entities/category'
import type { AppInfo } from '../../entities/app'

export interface DriveCategories {
	categories: CategoryDefinition[]
	categoryOrder: AppCategory[]
	collapsedCategories: AppCategory[]
	categoryOverrides: Record<string, AppCategory>
	categoryOverrideIdentities: Record<string, AppCategory>
}

function removeCategoryReferences(
	record: Record<string, AppCategory>,
	removed: Set<AppCategory>,
): Record<string, AppCategory> {
	return Object.fromEntries(
		Object.entries(record).filter(([, category]) => !removed.has(category)),
	)
}

export function reconcileDriveCategories(
	current: DriveCategories,
	apps: AppInfo[],
): DriveCategories | null {
	let categories = current.categories
	let categoryOrder = current.categoryOrder
	let collapsedCategories = current.collapsedCategories
	let categoryOverrides = current.categoryOverrides
	let categoryOverrideIdentities = current.categoryOverrideIdentities
	const added: CategoryDefinition[] = []
	const present = new Set<AppCategory>()
	let changed = false
	for (const app of apps) {
		const drive = driveCategoryFor(app)
		if (!drive) continue
		present.add(drive.id)
		if (added.some(category => category.id === drive.id)) continue
		const existing = categories.find(category => category.id === drive.id)
		if (existing) {
			if (
				isDefaultDriveLabel(existing.label) &&
				existing.label !== drive.label
			) {
				categories = categories.map(category =>
					category === existing
						? { ...category, label: drive.label }
						: category,
				)
				changed = true
			}
			continue
		}
		const legacy =
			drive.id === drive.letterId
				? undefined
				: categories.find(category => category.id === drive.letterId)
		if (legacy) {
			categories = categories.map(category =>
				category === legacy
					? {
							...category,
							id: drive.id,
							label: isDefaultDriveLabel(category.label)
								? drive.label
								: category.label,
						}
					: category,
			)
			categoryOrder = categoryOrder.map(id =>
				id === legacy.id ? drive.id : id,
			)
			changed = true
			continue
		}
		added.push({
			id: drive.id,
			label: drive.label,
			builtIn: false,
			accent: stableCustomCategoryAccent(drive.id),
		})
	}
	const removed = new Set(
		categories
			.filter(
				category =>
					isDriveCategory(category) &&
					isDefaultDriveLabel(category.label) &&
					!present.has(category.id),
			)
			.map(category => category.id),
	)
	if (removed.size > 0) {
		categories = categories.filter(category => !removed.has(category.id))
		categoryOrder = categoryOrder.filter(category => !removed.has(category))
		collapsedCategories = collapsedCategories.filter(
			category => !removed.has(category),
		)
		categoryOverrides = removeCategoryReferences(categoryOverrides, removed)
		categoryOverrideIdentities = removeCategoryReferences(
			categoryOverrideIdentities,
			removed,
		)
		changed = true
	}
	if (!changed && added.length === 0) return null
	return {
		categories: [...categories, ...added],
		categoryOrder: [
			...added.map(category => category.id),
			...categoryOrder,
		],
		collapsedCategories,
		categoryOverrides,
		categoryOverrideIdentities,
	}
}
