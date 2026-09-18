import type { AppView } from '../model/app.types'

const NON_CATALOG_VIEWS: ReadonlySet<AppView> = new Set<AppView>([
	'settings',
	'more',
	'scenarios',
	'catalog_health',
	'backup_restore',
])

export function isCatalogView(view: AppView): boolean {
	return !NON_CATALOG_VIEWS.has(view)
}
