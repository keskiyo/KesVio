import { readStylesheet } from './readStylesheet.mjs'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()

describe('window backdrop', () => {
	it('opens the page to Mica only when the window reports it and transparency is welcome', () => {
		const block = stylesheet.match(
			/@media \(prefers-reduced-transparency: no-preference\)\s*\{([\s\S]*?)\n\}/,
		)?.[1]
		expect(block).toBeTruthy()
		expect(block).toMatch(
			/:root\[data-backdrop='mica'\]\s*\{[^}]*background:\s*transparent/,
		)
		expect(block).toContain(":root[data-backdrop='mica'] .app-shell")
	})

	it('never makes the page transparent without the backdrop flag', () => {
		expect(stylesheet).not.toMatch(
			/(^|\})\s*:root\s*\{[^}]*background:\s*transparent/m,
		)
	})
})
