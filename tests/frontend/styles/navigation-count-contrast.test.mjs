import { readStylesheet } from './readStylesheet.mjs'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()

function oklchToken(name) {
	const match = stylesheet.match(
		new RegExp(`${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`),
	)
	expect(match, `${name} must be an opaque oklch token`).toBeTruthy()
	return match.slice(1, 4).map(Number)
}

function toOklab([lightness, chroma, hue]) {
	const radians = (hue * Math.PI) / 180
	return [lightness, chroma * Math.cos(radians), chroma * Math.sin(radians)]
}

function luminance([lightness, a, b]) {
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
	const [red, green, blue] = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map(channel => Math.min(1, Math.max(0, channel)))
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function mix(first, second, firstShare) {
	return first.map(
		(value, index) => value * firstShare + second[index] * (1 - firstShare),
	)
}

function contrastRatio(foreground, background) {
	const light = Math.max(luminance(foreground), luminance(background))
	const dark = Math.min(luminance(foreground), luminance(background))
	return (light + 0.05) / (dark + 0.05)
}

function accentShare(declaration, partner) {
	const mixed = declaration.match(
		new RegExp(
			`var\\(--navigation-category-accent\\)\\s+(\\d+)%,\\s*var\\(${partner}\\)`,
		),
	)
	if (mixed) return Number(mixed[1]) / 100
	expect(declaration.trim()).toBe('var(--navigation-category-accent)')
	return 1
}

const countRule =
	stylesheet.match(/\.navigation-category-count\s*\{([\s\S]*?)\n\}/)?.[1] ??
	''
const textShare = accentShare(
	countRule.match(/(?:^|\n)\s*color:\s*([\s\S]*?);/)?.[1] ?? '',
	'--text-primary',
)
const backgroundShare = accentShare(
	countRule.match(/background:\s*([\s\S]*?);/)?.[1] ?? '',
	'--surface-inset',
)

const accents = {
	...Object.fromEntries(
		[...stylesheet.matchAll(/(--category-[a-z]+):\s*oklch\(/g)].map(
			([, name]) => [name, toOklab(oklchToken(name))],
		),
	),
	'--text-muted': toOklab(oklchToken('--text-muted')),
	'--accent': toOklab(oklchToken('--accent')),
}

// The count badge painted its number in the raw category accent over a 16% tint of the same
// accent: Media measured 3.67:1, Browsers 3.97:1 and Development 4.38:1 at 12px, below WCAG AA.
describe('sidebar category count contrast', () => {
	it('reads every category accent at AA for 12px text', () => {
		const text = toOklab(oklchToken('--text-primary'))
		const surface = toOklab(oklchToken('--surface-inset'))
		expect(Object.keys(accents).length).toBeGreaterThanOrEqual(14)

		for (const [name, accent] of Object.entries(accents)) {
			const ratio = contrastRatio(
				mix(accent, text, textShare),
				mix(accent, surface, backgroundShare),
			)
			expect(ratio, name).toBeGreaterThanOrEqual(4.5)
		}
	})
})
