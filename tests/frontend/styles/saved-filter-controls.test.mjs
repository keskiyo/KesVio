import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = file => (existsSync(file) ? readFileSync(file, 'utf8') : '')
const dialog = read(
	'src/features/manage-filters/ui/SavedFilterDialog/SavedFilterDialog.tsx',
)
const criteria = read(
	'src/features/manage-filters/ui/SavedFilterDialog/CriteriaFieldset.tsx',
)
const choice = read(
	'src/features/manage-filters/ui/SavedFilterDialog/FilterChoice.tsx',
)
const actions = read(
	'src/features/manage-filters/ui/SavedFilterDialog/SavedFilterActions.tsx',
)
const publisher = read(
	'src/features/manage-filters/ui/SavedFilterDialog/PublisherCriteria.tsx',
)

describe('saved filter controls', () => {
	it('reuses the main search surface and shared destructive action', () => {
		expect(dialog).toContain('search-input')
		expect(actions).toContain('DANGER_ICON_BUTTON')
		expect(dialog).toContain('w-[min(40rem,calc(100vw-1rem))]')
		expect(dialog).toContain('overflow-y-auto')
		expect(dialog).toContain('shrink-0')
	})

	it('renders every checkbox and radio through one native control', () => {
		expect(criteria).toContain('<FilterChoice')
		expect(criteria).not.toContain('<input')
		expect(choice).toContain("type: 'checkbox' | 'radio'")
		expect(choice).toContain('peer sr-only')
		expect(choice).toContain('peer-focus-visible:outline-2')
		expect(criteria).toContain('min-[460px]:grid-cols-2')
		expect(criteria).toContain('grid-cols-2')
		expect(criteria).toContain('min-[460px]:grid-cols-3')
	})

	it('uses one controlled publisher-search clear action and compact text', () => {
		expect(publisher).toContain('role="searchbox"')
		expect(publisher).toContain('text-xs')
		expect(publisher).not.toContain('type="search"')
	})
})
