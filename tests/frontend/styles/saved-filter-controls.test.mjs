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
const disclosure = read(
	'src/features/manage-filters/ui/SavedFilterDialog/FilterDisclosure.tsx',
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

	it('keeps expanded publisher controls content-sized and single-axis scrollable', () => {
		expect(dialog).toContain('content-start')
		expect(criteria).toContain('content-start')
		expect(disclosure).toContain('min-w-0')
		expect(choice).toContain('min-w-0')
		expect(publisher).toContain('overflow-x-hidden')
		expect(publisher).toContain('overscroll-contain')
		expect(publisher).toContain('grid-cols-[minmax(0,1fr)]')
		expect(choice).toContain('relative')
	})

	// The clear action used to sit between the search field and the list, so the first selection
	// pushed the list down under the pointer; it now sits below the list in a row whose height is
	// reserved whether or not the action is shown, and the list itself has a fixed height.
	it('keeps the publisher list fixed-height with the clear action below it', () => {
		expect(publisher).toContain('h-52')
		expect(publisher).not.toContain('max-h-40')
		expect(publisher.indexOf('Clear publishers')).toBeGreaterThan(
			publisher.indexOf('visiblePublishers.map'),
		)
		expect(publisher).toContain('min-h-8')
	})

	// Focusing a checkbox while the disclosure was still expanding scrolled the panel's
	// overflow-hidden wrapper and left the search field hidden above the list; `overflow: clip`
	// is not a scroll container, so focus cannot move it.
	it('keeps the disclosure wrapper unscrollable so focus cannot hide the search field', () => {
		const panel = read('src/shared/ui/CollapsiblePanel.tsx')
		expect(panel).toContain('overflow-clip')
		expect(panel).not.toContain('overflow-hidden')
		expect(panel).toContain('min-h-0')
	})
})
