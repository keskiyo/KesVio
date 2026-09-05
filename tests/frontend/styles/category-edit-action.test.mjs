import { readStylesheet } from './readStylesheet.mjs'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()

describe('category edit action styles', () => {
	it('does not paint a background on hover', () => {
		expect(stylesheet).not.toContain('.category-edit-action:hover')
	})
})
