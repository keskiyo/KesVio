import { readStylesheet } from './readStylesheet.mjs'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()
const app = readFileSync('src/app/App.tsx', 'utf8')

function rule(selector) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
	const body = stylesheet.match(
		new RegExp(String.raw`(^|\})\s*${escaped}\s*\{([^}]*)\}`, 'm'),
	)?.[2]
	expect(body, `${selector} exists`).toBeTruthy()
	return body
}

describe('toaster theme', () => {
	it('uses the dark Sonner base instead of the default light palette', () => {
		expect(app).toMatch(/<Toaster[\s\S]*theme="dark"/)
		expect(app).not.toMatch(/<Toaster[\s\S]*richColors/)
	})

	it('renders every toast on the graphite application surface', () => {
		const toast = rule(
			`.app-toaster [data-sonner-toast][data-styled='true']`,
		)
		expect(toast).toContain('background: var(--surface-raised) !important')
		expect(toast).toContain('color: var(--text-primary) !important')
		expect(toast).toContain(
			'border: 1px solid var(--border-neutral) !important',
		)
	})

	// Sonner treats anything under 600px as a phone and stretches the toaster to the full viewport.
	// The window can be dragged down to 430px, so that band is reachable and turned a one-line
	// notice into a bar across the catalog.
	it('keeps the toast in its corner at the narrow window sizes Sonner calls mobile', () => {
		const narrow = rule('.app-toaster[data-sonner-toaster]')

		expect(narrow).toContain('left: auto')
		expect(narrow).toContain('width: var(--width)')
		expect(
			rule('.app-toaster[data-sonner-toaster] [data-sonner-toast]'),
		).toContain('width: 100%')
		expect(stylesheet).toMatch(
			/@media \(max-width: 600px\) \{\s*\.app-toaster\[data-sonner-toaster\]/,
		)
	})

	it('keeps semantic colour on the status icon instead of the whole toast', () => {
		expect(
			rule(
				`.app-toaster [data-sonner-toast][data-type='success'] [data-icon]`,
			),
		).toContain('var(--category-green)')
		expect(
			rule(
				`.app-toaster [data-sonner-toast][data-type='error'] [data-icon]`,
			),
		).toContain('var(--category-red)')
	})
})
