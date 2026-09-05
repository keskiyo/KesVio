import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync('src/app/styles/index.css', 'utf8')

function rule(selector) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
	const body = stylesheet.match(
		new RegExp(String.raw`(^|\})\s*${escaped}\s*\{([^}]*)\}`, 'm'),
	)?.[2]
	expect(body, `${selector} exists`).toBeTruthy()
	return body
}

/**
 * Every size the catalog tile paints comes from one of these tokens. A preset that forgets one
 * silently inherits the comfortable value, which is how a dense grid ends up with a comfortable
 * icon overflowing a short card — so the contract is that each preset redefines the whole set.
 */
const TILE_TOKENS = [
	'--app-card-width',
	'--app-card-height',
	'--app-card-gap',
	'--app-card-radius',
	'--app-card-padding-block',
	'--app-card-padding-inline',
	'--app-card-stack-gap',
	'--app-card-icon-tile',
	'--app-card-icon-image',
	'--app-card-name-size',
	'--app-card-version-display',
	'--app-card-action-size',
	'--app-card-action-inset',
	'--app-card-platform-badge-size',
	'--app-card-platform-icon-size',
	'--app-card-platform-badge-inset',
	'--app-card-row-height',
]

describe('catalog density presets', () => {
	it('keeps the comfortable preset as the unattributed default', () => {
		for (const token of TILE_TOKENS) {
			expect(stylesheet, `${token} has a default`).toContain(`${token}: `)
		}
		expect(stylesheet).toContain('--app-card-width: 8rem;')
		expect(stylesheet).toContain('--app-card-height: 7.875rem;')
		expect(stylesheet).toContain('--app-card-gap: 0.625rem;')
	})

	it('redefines every tile token in each preset', () => {
		for (const preset of ['compact', 'dense']) {
			const block = rule(`.app-shell[data-density='${preset}']`)
			for (const token of TILE_TOKENS) {
				expect(block, `${preset} sets ${token}`).toContain(`${token}:`)
			}
		}
	})

	it('shrinks the tile monotonically from comfortable to dense', () => {
		const width = preset =>
			Number(
				/--app-card-width:\s*([\d.]+)rem/.exec(
					rule(`.app-shell[data-density='${preset}']`),
				)[1],
			)

		expect(width('compact')).toBeLessThan(8)
		expect(width('dense')).toBeLessThan(width('compact'))
	})

	it('hides the version line below comfortable', () => {
		expect(stylesheet).toContain('--app-card-version-display: block;')
		for (const preset of ['compact', 'dense']) {
			expect(rule(`.app-shell[data-density='${preset}']`)).toContain(
				'--app-card-version-display: none',
			)
		}
	})

	it('routes every tile size through a token', () => {
		expect(rule('.app-card-tile')).toContain(
			'border-radius: var(--app-card-radius)',
		)
		expect(rule('.app-card-face')).toContain('var(--app-card-stack-gap)')
		expect(rule('.app-card-icon')).toContain('var(--app-card-icon-tile)')
		expect(rule('.app-card-icon-image')).toContain(
			'var(--app-card-icon-image)',
		)
		expect(rule('.app-card-name')).toContain('var(--app-card-name-size)')
		expect(rule('.app-card-version')).toContain(
			'var(--app-card-version-display)',
		)
		expect(rule('.app-card-row')).toContain('var(--app-card-row-height)')
		expect(rule('.app-card-platform-badge')).toContain(
			'bottom: var(--app-card-platform-badge-inset)',
		)
		expect(rule('.app-card-platform-badge')).toContain(
			'left: var(--app-card-platform-badge-inset)',
		)
		expect(rule('.app-card-platform-badge')).toContain(
			'width: var(--app-card-platform-badge-size)',
		)
		expect(rule('.app-card-platform-badge')).toContain(
			'height: var(--app-card-platform-badge-size)',
		)
		expect(rule('.app-card-platform-icon')).toContain(
			'var(--app-card-platform-icon-size)',
		)
	})

	// FavoriteStar carries its own `size-8` for every caller, catalog or not. The corner controls
	// only shrink if the density rule outranks that utility, which is what the descendant selector
	// buys; a bare `.app-card-action` would tie and lose to whichever came last.
	it('outranks the utility class on the corner controls', () => {
		expect(stylesheet).toContain('.app-card-tile .app-card-action {')
		expect(rule('.app-card-tile .app-card-action')).toContain(
			'var(--app-card-action-size)',
		)
		expect(rule('.app-card-tile .app-card-action-menu')).toContain(
			'left: var(--app-card-action-inset)',
		)
		expect(rule('.app-card-tile .app-card-action-favorite')).toContain(
			'right: var(--app-card-action-inset)',
		)
	})

	/**
	 * The selected segment is a thumb that slides between the three options, so the columns must be
	 * equal and flush: with a gap between them, `translateX(100%)` moves by the thumb's own width
	 * and lands short of the next label by exactly that gap.
	 */
	it('slides the selection between three equal, flush columns', () => {
		const control = readFileSync(
			'src/pages/settings/ui/components/DensityControl.tsx',
			'utf8',
		)

		expect(control).toContain('grid-cols-3')
		expect(control).not.toMatch(/\bgap-\d/)
		expect(control).toContain('density-thumb')

		const thumb = rule('.density-thumb')
		expect(thumb).toContain('var(--motion-ease-out)')
		expect(thumb).toMatch(/transition:\s*transform \d+ms/)
		expect(rule("[data-selected='compact'] > .density-thumb")).toContain(
			'translateX(100%)',
		)
		expect(rule("[data-selected='dense'] > .density-thumb")).toContain(
			'translateX(200%)',
		)
	})

	it('stops the thumb sliding under reduced motion', () => {
		const reduced = stylesheet.match(
			/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/,
		)?.[1]

		expect(reduced).toContain('.density-thumb')
	})

	it('keeps card sizes out of the components', () => {
		const sources = [
			'src/entities/app/ui/AppCard/AppCard.tsx',
			'src/entities/app/ui/AppCard/CardIcon.tsx',
			'src/entities/app/ui/AppCard/CardLabel.tsx',
			'src/widgets/catalog-content/ui/AppGrid/Skeleton.tsx',
			'src/widgets/catalog-content/ui/AuxiliaryToolRow/AuxiliaryToolRow.tsx',
		].map(file => readFileSync(file, 'utf8'))

		for (const source of sources) {
			expect(source).not.toMatch(/\bsize-13\b/)
			expect(source).not.toMatch(/\bsize-9\.5\b/)
			expect(source).not.toMatch(/\bmin-h-18\b/)
			expect(source).not.toContain('rounded-[1.15rem]')
		}
	})
})
