import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readStylesheet } from './readStylesheet.mjs'

const stylesheet = readStylesheet()
const baseStyles = readFileSync('src/app/styles/base.css', 'utf8')

function readOklchToken(name) {
	const match = stylesheet.match(
		new RegExp(
			`${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)`,
		),
	)
	expect(match, `${name} must be an OKLCH token`).toBeTruthy()
	return {
		lightness: Number(match[1]),
		chroma: Number(match[2]),
		hue: Number(match[3]),
		alpha: match[4] ? Number(match[4]) : 1,
	}
}

function toLinearRgb({ lightness, chroma, hue }) {
	const radians = (hue * Math.PI) / 180
	const a = chroma * Math.cos(radians)
	const b = chroma * Math.sin(radians)
	const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b
	const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b
	const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b
	const l = lRoot ** 3
	const m = mRoot ** 3
	const s = sRoot ** 3

	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	]
}

function composite(foreground, alpha, background) {
	return foreground.map(
		(channel, index) => channel * alpha + background[index] * (1 - alpha),
	)
}

function luminance(rgb) {
	return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function contrastRatio(foreground, background) {
	const light = Math.max(luminance(foreground), luminance(background))
	const dark = Math.min(luminance(foreground), luminance(background))
	return (light + 0.05) / (dark + 0.05)
}

describe('shared UI accessibility polish', () => {
	it.each(['--text-muted', '--text-subtle'])(
		'%s remains readable on the raised application surface',
		textToken => {
			const canvas = toLinearRgb(readOklchToken('--surface-canvas'))
			const raisedToken = readOklchToken('--surface-raised')
			const raised = composite(
				toLinearRgb(raisedToken),
				raisedToken.alpha,
				canvas,
			)
			const text = toLinearRgb(readOklchToken(textToken))

			expect(contrastRatio(text, raised)).toBeGreaterThanOrEqual(4.5)
		},
	)

	it('provides 44 pixel hit areas for coarse pointers without enlarging the title bar', () => {
		expect(baseStyles).toMatch(/@media\s*\(pointer:\s*coarse\)/)
		expect(baseStyles).toMatch(
			/\.app-shell button[^,{]*,[\s\S]*?\.app-shell a\[href\][^{]*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/,
		)
		expect(baseStyles).toMatch(
			/\.app-titlebar button\s*\{[\s\S]*?min-height:\s*36px;/,
		)
	})

	// The status row holds the saved-filter chip, so it reserves the chip's height for each input
	// kind: without it, a chip whose buttons grow to 44 px under touch would grow the header again.
	// The touch height must come after the default in the cascade: placed in base.css it was
	// overridden by the later surfaces.css rule of the same specificity and never applied.
	it('reserves the header status row height for mouse and touch input', () => {
		const mouse = stylesheet.search(
			/\.app-header-status\s*\{\s*height:\s*1\.75rem;/,
		)
		const touch = stylesheet.search(
			/@media\s*\(pointer:\s*coarse\)\s*\{\s*\.app-header-status\s*\{\s*height:\s*44px;/,
		)

		expect(mouse).toBeGreaterThan(-1)
		expect(touch).toBeGreaterThan(mouse)
	})

	it('leaves absolutely positioned overlay controls at their own size on coarse pointers', () => {
		// The card menu and favourite buttons, the scenario tile remove badges and
		// the search clear button sit on top of content. Growing them to 44 px
		// covered the app icon on every catalog card under touch input.
		const coarseRule = baseStyles.match(
			/@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/,
		)?.[1]

		expect(coarseRule).toBeTruthy()
		expect(coarseRule).toMatch(
			/\.app-shell button:where\(:not\(\.absolute\)\)/,
		)
		expect(coarseRule).toMatch(
			/\.app-shell a\[href\]:where\(:not\(\.absolute\)\)/,
		)
	})

	it('keeps the brand update action an overlay so touch sizing cannot cover the name', () => {
		// The update pill sits over the version line inside the home button's area. In flow,
		// the 44 px coarse minimum grew it over the app name and stole taps meant for home.
		const identity = readFileSync(
			'src/widgets/sidebar-navigation/ui/NavigationIdentity.tsx',
			'utf8',
		)
		const pillClasses = identity.match(
			/<UpdatePill[\s\S]*?className="([^"]*)"/,
		)?.[1]
		const pill = readFileSync(
			'src/features/update-app/ui/UpdatePill.tsx',
			'utf8',
		)

		expect(pillClasses).toBeTruthy()
		expect(pillClasses.split(/\s+/)).toContain('absolute')
		expect(pill.match(/className=\{`\$\{className\}/g)).toHaveLength(2)
	})
})
