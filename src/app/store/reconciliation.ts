import { appIdentity } from '../../entities/app'
import type { AppCategory } from '../../entities/category'
import type { AppInfo } from '../../entities/app'
import { reconcileOverrides, reconcileSelection } from './markResolution'
import type { LegacyCanonicalPreferences } from './preferences'

export const identityOf = appIdentity

interface CatalogMarks {
	favoriteAppIds: string[]
	favoriteAppIdentities: string[]
	hiddenAppIds: string[]
	hiddenAppIdentities: string[]
	promotedAppIds: string[]
	promotedAppIdentities: string[]
	installerAppIds: string[]
	installerAppIdentities: string[]
	documentAppIds: string[]
	documentAppIdentities: string[]
	categoryOverrides: Record<string, AppCategory>
	categoryOverrideIdentities: Record<string, AppCategory>
	legacyCanonicalPreferences: LegacyCanonicalPreferences
}

function sameOrder(left: string[], right: string[]): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	)
}

function sameCategories(
	left: Record<string, AppCategory>,
	right: Record<string, AppCategory>,
): boolean {
	const keys = Object.keys(left)
	return (
		keys.length === Object.keys(right).length &&
		keys.every(key => left[key] === right[key])
	)
}

function marksEqual(left: CatalogMarks, right: CatalogMarks): boolean {
	return (
		sameOrder(left.favoriteAppIds, right.favoriteAppIds) &&
		sameOrder(left.favoriteAppIdentities, right.favoriteAppIdentities) &&
		sameOrder(left.hiddenAppIds, right.hiddenAppIds) &&
		sameOrder(left.hiddenAppIdentities, right.hiddenAppIdentities) &&
		sameOrder(left.promotedAppIds, right.promotedAppIds) &&
		sameOrder(left.promotedAppIdentities, right.promotedAppIdentities) &&
		sameOrder(left.installerAppIds, right.installerAppIds) &&
		sameOrder(left.installerAppIdentities, right.installerAppIdentities) &&
		sameOrder(left.documentAppIds, right.documentAppIds) &&
		sameOrder(left.documentAppIdentities, right.documentAppIdentities) &&
		sameCategories(left.categoryOverrides, right.categoryOverrides) &&
		sameCategories(
			left.categoryOverrideIdentities,
			right.categoryOverrideIdentities,
		) &&
		sameOrder(
			left.legacyCanonicalPreferences.favorite,
			right.legacyCanonicalPreferences.favorite,
		) &&
		sameOrder(
			left.legacyCanonicalPreferences.hidden,
			right.legacyCanonicalPreferences.hidden,
		) &&
		sameOrder(
			left.legacyCanonicalPreferences.promoted,
			right.legacyCanonicalPreferences.promoted,
		) &&
		sameOrder(
			left.legacyCanonicalPreferences.installer,
			right.legacyCanonicalPreferences.installer,
		) &&
		sameOrder(
			left.legacyCanonicalPreferences.document,
			right.legacyCanonicalPreferences.document,
		) &&
		sameCategories(
			left.legacyCanonicalPreferences.categoryOverrides,
			right.legacyCanonicalPreferences.categoryOverrides,
		)
	)
}

export function reconcileMarks(
	current: CatalogMarks,
	apps: AppInfo[],
): CatalogMarks | null {
	if (apps.length === 0) return null
	const legacy = current.legacyCanonicalPreferences
	const favorites = reconcileSelection(
		apps,
		current.favoriteAppIds,
		current.favoriteAppIdentities,
		legacy.favorite,
	)
	const hidden = reconcileSelection(
		apps,
		current.hiddenAppIds,
		current.hiddenAppIdentities,
		legacy.hidden,
	)
	const promoted = reconcileSelection(
		apps,
		current.promotedAppIds,
		current.promotedAppIdentities,
		legacy.promoted,
	)
	const installers = reconcileSelection(
		apps,
		current.installerAppIds,
		current.installerAppIdentities,
		legacy.installer,
	)
	const documents = reconcileSelection(
		apps,
		current.documentAppIds,
		current.documentAppIdentities,
		legacy.document,
	)
	const overrides = reconcileOverrides(
		apps,
		current.categoryOverrides,
		current.categoryOverrideIdentities,
		legacy.categoryOverrides,
	)
	const next: CatalogMarks = {
		favoriteAppIds: favorites.ids,
		favoriteAppIdentities: favorites.identities,
		hiddenAppIds: hidden.ids,
		hiddenAppIdentities: hidden.identities,
		promotedAppIds: promoted.ids,
		promotedAppIdentities: promoted.identities,
		installerAppIds: installers.ids,
		installerAppIdentities: installers.identities,
		documentAppIds: documents.ids,
		documentAppIdentities: documents.identities,
		categoryOverrides: overrides.overrides,
		categoryOverrideIdentities: overrides.overrideIdentities,
		legacyCanonicalPreferences: {
			favorite: favorites.unresolvedLegacy,
			hidden: hidden.unresolvedLegacy,
			promoted: promoted.unresolvedLegacy,
			installer: installers.unresolvedLegacy,
			document: documents.unresolvedLegacy,
			categoryOverrides: overrides.unresolvedLegacy,
		},
	}
	return marksEqual(current, next) ? null : next
}

export function addUnique(list: string[], value: string): string[] {
	return list.includes(value) ? list : [...list, value]
}
