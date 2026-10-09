import { readStylesheet } from './readStylesheet.mjs'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()

describe('category header actions', () => {
	it('hides Edit at rest and reveals it while the section is hovered or focused', () => {
		expect(stylesheet).toMatch(
			/\.category-header-action\s*\{[^}]*opacity:\s*0/,
		)
		expect(stylesheet).toMatch(
			/\[data-category\]:is\(:hover, :focus-within\)\s+\.category-header-action\s*\{[^}]*opacity:\s*1/,
		)
	})

	it('keeps Edit visible where nothing can hover', () => {
		expect(stylesheet).toMatch(
			/@media \(hover: none\)\s*\{\s*\.category-header-action\s*\{[^}]*opacity:\s*1/,
		)
	})
})
