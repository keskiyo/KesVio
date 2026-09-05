import { readStylesheet } from './readStylesheet.mjs'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()

describe('overlay layout stability', () => {
	it('reserves the catalog scrollbar gutter while overlays lock scrolling', () => {
		const style = document.createElement('style')
		const catalog = document.createElement('div')
		const catalogRule = stylesheet.match(/#catalog-scroll\s*\{[^}]+\}/)?.[0]
		expect(catalogRule).toBeTruthy()
		style.textContent = catalogRule ?? ''
		catalog.id = 'catalog-scroll'
		document.head.append(style)
		document.body.append(catalog)

		expect(getComputedStyle(catalog).scrollbarGutter).toBe('stable')

		catalog.remove()
		style.remove()
	})
})
