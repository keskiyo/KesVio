import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const component = readFileSync(
	'src/entities/app/ui/AppCard/PlatformBadge.tsx',
	'utf8',
)
const stylesheet = readFileSync('src/app/styles/index.css', 'utf8')

describe('platform badge colors', () => {
	it('uses one white-on-dark treatment for every platform', () => {
		expect(component).toContain('bg-slate-950/75')
		expect(component).toContain('text-white')
		expect(component).not.toContain('bg-white/78')
		expect(stylesheet).not.toMatch(
			/\.app-card-platform-badge\[data-platform=/,
		)
		expect(stylesheet).not.toMatch(/--platform-/)
	})
})
