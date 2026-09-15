import type { AppCategory, CategoryDefinition } from '../model/category.types'

const DRIVE_ROOT = /^([A-Za-z]):[\\/]?$/
const DRIVE_CATEGORY = /^drive:(?:[a-z]|[0-9a-f]{8})$/
const DEFAULT_LABEL = /^Disk [A-Z]$/
const VOLUME_KEY = /^[0-9a-f]{8}$/

export const DRIVE_CATEGORY_PREFIX = 'drive:'

export interface DriveLocation {
	scanFolder?: string | null
	volumeId?: string | null
}

export interface DriveCategory {
	id: AppCategory
	label: string
	letterId: AppCategory
}

export function driveCategoryFor(
	location: DriveLocation | null | undefined,
): DriveCategory | null {
	const letter = location?.scanFolder?.trim().match(DRIVE_ROOT)?.[1]
	if (!letter) return null
	const letterId = `${DRIVE_CATEGORY_PREFIX}${letter.toLowerCase()}`
	const volume = location?.volumeId?.trim().toLowerCase()
	return {
		id:
			volume && VOLUME_KEY.test(volume)
				? `${DRIVE_CATEGORY_PREFIX}${volume}`
				: letterId,
		label: `Disk ${letter.toUpperCase()}`,
		letterId,
	}
}

export function isDefaultDriveLabel(label: string): boolean {
	return DEFAULT_LABEL.test(label)
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
