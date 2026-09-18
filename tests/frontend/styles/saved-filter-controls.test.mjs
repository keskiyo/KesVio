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
const panel = read('src/shared/ui/CollapsiblePanel.tsx')

describe('saved filter controls', () => {
	it('reuses the main search surface and shared destructive action', () => {
		expect(dialog).toContain('search-input')
		expect(actions).toContain('DANGER_ICON_BUTTON')
	})

	it('renders every checkbox and radio through one native control', () => {
		expect(criteria).toContain('<FilterChoice')
		expect(criteria).not.toContain('<input')
		expect(choice).toContain("type: 'checkbox' | 'radio'")
		expect(choice).toContain('peer sr-only')
		expect(choice).toContain('peer-focus-visible:outline-2')
	})

	it('uses one controlled publisher-search clear action', () => {
		expect(publisher).toContain('role="searchbox"')
		expect(publisher).not.toContain('type="search"')
	})

	// Selecting a publisher used to insert the clear action between the search field and the
	// list, so the first click pushed the list down under the pointer.
	it('keeps the publisher list fixed-height with the clear action below it', () => {
		expect(publisher).toMatch(/\bh-\d+\b/)
		expect(publisher).not.toMatch(/\bmax-h-\d+\b/)
		expect(publisher.indexOf('Clear publishers')).toBeGreaterThan(
			publisher.indexOf('visiblePublishers.map'),
		)
	})

	// Focusing a checkbox while the disclosure was still expanding scrolled the panel's
	// overflow-hidden wrapper and left the search field hidden above the list; `overflow: clip`
	// is not a scroll container, so focus cannot move it.
	it('keeps the disclosure wrapper unscrollable so focus cannot hide the search field', () => {
		expect(panel).toContain('overflow-clip')
		expect(panel).not.toContain('overflow-hidden')
		expect(panel).toContain('min-h-0')
	})
})
