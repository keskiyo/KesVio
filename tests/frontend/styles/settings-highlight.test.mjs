import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { readStylesheet } from './readStylesheet.mjs'

const rules = []
postcss.parse(readStylesheet()).walkRules(rule => {
	if (rule.selector.includes('bg-violet-100')) rules.push(rule)
})

describe('violet highlight compatibility rule', () => {
	it.each([
		'hover:bg-violet-100',
		'hover:bg-violet-100/55',
		'hover:bg-violet-100/70',
		'hover:bg-violet-100/75',
	])('only paints %s while the pointer is on the control', className => {
		const wrapper = document.createElement('div')
		wrapper.className = 'theme-graphite-surface'
		const control = wrapper.appendChild(document.createElement('button'))
		control.className = className
		expect(rules.length).toBeGreaterThan(0)
		const applicable = rules.filter(rule =>
			control.matches(rule.selector.replace(/:hover\b/g, '')),
		)
		expect(applicable).toHaveLength(1)
		expect(control.matches(applicable[0].selector)).toBe(false)
		expect(applicable[0].selector.trim()).toMatch(/:hover$/)
		expect(
			applicable[0].nodes.some(node => node.prop === 'background-color'),
		).toBe(true)
		control.className = `prefix-${className}-suffix`
		expect(
			control.matches(applicable[0].selector.replace(/:hover\b/g, '')),
		).toBe(false)
	})
	it('uses a translucent tint rather than an opaque fill', () => {
		expect(rules.length).toBeGreaterThan(0)
		for (const rule of rules) {
			const color = rule.nodes.find(
				node => node.prop === 'background-color',
			)?.value
			const alpha = color?.match(/oklch\([^)]*\/\s*([\d.]+)\s*\)/)?.[1]
			expect(alpha).toBeDefined()
			expect(Number(alpha)).toBeGreaterThan(0)
			expect(Number(alpha)).toBeLessThan(0.35)
		}
	})
})
