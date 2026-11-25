export interface CatalogScanChanges {
	added: string[]
	updated: string[]
	addedIds?: string[]
	updatedIds?: string[]
	removed: string[]
	truncated: boolean
}
