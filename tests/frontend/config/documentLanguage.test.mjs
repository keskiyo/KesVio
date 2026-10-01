import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const indexHtml = readFileSync('index.html', 'utf8')

// Every interface string is English, but the document declared `lang="ru"`, so Narrator and other
// screen readers read the whole window with Russian pronunciation (WCAG 3.1.1, level A).
describe('document language', () => {
	it('declares the language the interface is written in', () => {
		expect(indexHtml).toMatch(/<html\s+lang="en">/)
	})
})
