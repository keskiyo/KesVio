import { readStylesheet } from './readStylesheet.mjs'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()
const appSource = readFileSync('src/app/App.tsx', 'utf8')

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

	it('renders the catalog as a unified canvas instead of a raised panel', () => {
		const catalogScrollClass = appSource.match(
			/id="catalog-scroll"[\s\S]*?className="([^"]+)"/,
		)?.[1]

		expect(appSource).toMatch(/className="[^"]*catalog-canvas[^"]*"/)
		expect(catalogScrollClass).not.toContain('app-panel')
		expect(catalogScrollClass).not.toContain('rounded-2xl')
		expect(stylesheet).toMatch(
			/(^|\})\s*::-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent/m,
		)
		expect(stylesheet).toMatch(
			/::-webkit-scrollbar-button\s*\{[^}]*display:\s*none/,
		)
		expect(stylesheet).not.toContain('#catalog-scroll::-webkit-scrollbar')
	})

	it('draws the desktop sidebar and the header from one chrome material and one divider', () => {
		const rule = selector =>
			[...stylesheet.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(
				([, selectors]) => selectors.trim() === selector,
			)?.[2] ?? ''

		expect(stylesheet).toMatch(
			/\.app-header-glass,\s*\.app-sidebar\s*\{[^}]*background:\s*var\(--shell-chrome\)/,
		)
		expect(rule('.app-header-glass')).toContain(
			'border-bottom: 1px solid var(--shell-divider)',
		)
		expect(rule('.app-sidebar')).toContain(
			'border-right: 1px solid var(--shell-divider)',
		)
		expect(rule('.app-sidebar-brand')).toContain(
			'border-bottom: 1px solid var(--shell-divider)',
		)
		expect(stylesheet).not.toMatch(/\.app-panel\s*\{/)
	})

	it('declares no standard scrollbar colour or width that would silence the webkit scrollbar rules', () => {
		// Chromium ignores every ::-webkit-scrollbar rule on an element whose
		// scrollbar-color or scrollbar-width is not auto, and scrollbar-color is
		// inherited: one declaration on :root brought back the 15 px native
		// scrollbar with arrow buttons on every scroll surface of the WebView2.
		expect(stylesheet).not.toMatch(/scrollbar-color\s*:/)
		expect(stylesheet).not.toMatch(/scrollbar-width\s*:\s*(?!none\b)/)
	})
})
