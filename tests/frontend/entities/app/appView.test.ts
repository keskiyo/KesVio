import { describe, expect, it } from 'vitest'
import { isCatalogView, type AppView } from '../../../../src/entities/app'

describe('isCatalogView', () => {
	it('treats every list of applications as a catalog view', () => {
		for (const view of [
			'all',
			'favorites',
			'hidden',
			'auxiliary',
			'installers_docs',
		] satisfies AppView[])
			expect(isCatalogView(view), view).toBe(true)
	})

	// The tool pages reached from More hold no application list: they must not render the
	// catalog, take part in search or hydrate icons.
	it('keeps the pages without an application list out of the catalog', () => {
		for (const view of [
			'settings',
			'more',
			'scenarios',
			'catalog_health',
			'backup_restore',
		] satisfies AppView[])
			expect(isCatalogView(view), view).toBe(false)
	})
})
