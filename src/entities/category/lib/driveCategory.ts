import type { AppCategory, CategoryDefinition } from '../model/category.types'

const DRIVE_ROOT = /^([A-Za-z]):[\\/]?$/
const DRIVE_CATEGORY = /^drive:[a-z]$/

export const DRIVE_CATEGORY_PREFIX = 'drive:'

export interface DriveCategory {
	id: AppCategory
	label: string
}

export function driveCategoryFor(
	scanFolder: string | null | undefined,
): DriveCategory | null {
	const letter = scanFolder?.trim().match(DRIVE_ROOT)?.[1]
	if (!letter) return null
	return {
		id: `${DRIVE_CATEGORY_PREFIX}${letter.toLowerCase()}`,
		label: `Disk ${letter.toUpperCase()}`,
	}
}

export function isDriveCategory(category: CategoryDefinition): boolean {
	return isDriveCategoryId(category.id)
}

export function isDriveCategoryId(id: string): boolean {
	return DRIVE_CATEGORY.test(id)
}

export function staysVisibleWhenEmpty(category: CategoryDefinition): boolean {
	return !category.builtIn && !isDriveCategory(category)
}
