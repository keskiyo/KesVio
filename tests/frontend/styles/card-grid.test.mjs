import { readStylesheet } from './readStylesheet.mjs'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readStylesheet()

function rule(selector) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
	const body = stylesheet.match(
		new RegExp(String.raw`(^|\})\s*${escaped}\s*\{([^}]*)\}`, 'm'),
	)?.[2]
	expect(body, `${selector} exists`).toBeTruthy()
	return body
}

function sourceFiles(directory, found = []) {
	for (const entry of readdirSync(directory)) {
		const full = join(directory, entry)
		if (statSync(full).isDirectory()) sourceFiles(full, found)
		else if (/\.tsx?$/.test(entry)) found.push(full)
	}
	return found
}

/**
 * The catalog tile has a fixed size and the grid lays out as many fixed tracks as fit. That only
 * works while the track and the tile are the same width — if they drift, every row either clips
 * its last tile or leaves a column-sized hole. The value lives in one token; this test is what
 * keeps both users of it pointed at that token.
 */
describe('catalog card grid', () => {
	it('sizes the grid track from the same token as the tile', () => {
		expect(rule('.app-card-grid')).toContain(
			'repeat(auto-fill, var(--app-card-width))',
		)
		expect(rule('.app-card-tile')).toContain('width: var(--app-card-width)')
		expect(rule('.app-card-tile')).toContain(
			'height: var(--app-card-height)',
		)
	})

	it('centers fixed tracks with a compact shared gap', () => {
		expect(stylesheet).toContain('--app-card-gap: 0.625rem;')
		expect(rule('.app-card-grid')).toContain('gap: var(--app-card-gap)')
		expect(rule('.app-card-grid')).toContain('justify-content: center')
	})

	// Two decorative layers used to sit behind every card: a near-black drop shadow that read as a
	// dark plate on the graphite surface, and a blurred violet bar under the bottom edge that
	// smeared across the full width of an auxiliary row. Elevation is the rim plus one faint glow.
	it('lifts cards without a plate behind them', () => {
		expect(rule('.app-card-glass')).not.toContain('oklch(0.14')
		expect(rule('.app-card-tile.app-card-glass')).not.toContain(
			'oklch(0.14',
		)
		expect(stylesheet).not.toContain('.app-card-glass::after')
	})

	it('uses a single quiet edge and a thinner interactive spotlight', () => {
		const glass = rule('.app-card-tile.app-card-glass')
		expect(glass).not.toContain('0 0 0 1px')
		expect(glass).toContain('0 8px 22px oklch(0.58 0.14 292 / 0.06)')
		expect(rule('.app-card-tile .spotlight::before')).toContain(
			'padding: 1.4px',
		)
	})

	it('keeps a full-width auxiliary row no louder than a tile', () => {
		expect(rule('.app-card-glass')).toContain(
			'0 6px 18px oklch(0.58 0.14 292 / 0.05)',
		)
		expect(rule('.spotlight::before')).toContain('padding: 2.4px')
	})

	it('reserves the real tile height for off-screen cards', () => {
		// A placeholder taller or shorter than the card makes the scrollbar jump as cards mount.
		expect(rule('.cv-card')).toContain(
			'contain-intrinsic-size: auto var(--app-card-height)',
		)
	})

	it('lets the catalog column count follow the width instead of fixed breakpoints', () => {
		// Every catalog surface (categories, favorites, hidden, artifacts, the loading skeleton)
		// goes through `.app-card-grid`. A breakpoint-pinned column list here would resize the
		// tile again and is what this layout replaced.
		const offenders = [
			...sourceFiles('src/widgets/catalog-content'),
			...sourceFiles('src/entities/app'),
		].filter(file =>
			/\b(sm|md|lg|xl):grid-cols-/.test(readFileSync(file, 'utf8')),
		)

		expect(offenders).toEqual([])
	})

	it('keeps Favorites applications on the shared auto-fitting grid', () => {
		const favorites = readFileSync(
			'src/widgets/catalog-content/ui/FavoritesGrid/FavoritesGrid.tsx',
			'utf8',
		)

		expect(favorites).toContain('className="app-card-grid"')
		expect(favorites).not.toContain('favorites-app-card-grid')
	})

	// The scenario cards used to stay one per row until 781 px, so on a narrow window two starred
	// scenarios filled the screen before the first application. A compact card is narrow enough
	// for two in a row at the 446 px minimum, and the column count follows the width from there.
	it('fits two favorite scenarios in a row at the minimum window width', () => {
		const scenarios = readFileSync(
			'src/features/manage-scenarios/ui/FavoriteScenarioList/FavoriteScenarioList.tsx',
			'utf8',
		)

		expect(scenarios).toContain(
			'grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))]',
		)
		expect(scenarios).toContain('items-start')
	})

	it('bounds favorite scenarios to three substantial desktop columns', () => {
		const scenarios = readFileSync(
			'src/features/manage-scenarios/ui/FavoriteScenarioList/FavoriteScenarioList.tsx',
			'utf8',
		)

		expect(scenarios).toContain('sm:max-w-[61rem]')
		expect(scenarios).toContain(
			'sm:grid-cols-[repeat(auto-fill,minmax(18rem,20rem))]',
		)
	})

	it('keeps the scenario disclosure target large and its details display-only', () => {
		const card = readFileSync(
			'src/features/manage-scenarios/ui/FavoriteScenarioList/FavoriteScenarioCard.tsx',
			'utf8',
		)

		expect(card).toContain('self-stretch')
		expect(card).toContain("from './FavoriteScenarioAppList'")
		expect(card).not.toContain('ScenarioRunList')
	})

	it('renders favorite scenario contents as compact icon-only tiles', () => {
		const details = readFileSync(
			'src/features/manage-scenarios/ui/FavoriteScenarioList/FavoriteScenarioAppList.tsx',
			'utf8',
		)

		expect(details).toContain('flex min-w-0 flex-wrap gap-1.5')
		expect(details).toContain('size-8 shrink-0')
		expect(details).not.toContain('truncate text-xs')
	})

	it('keeps section hints near their headings on desktop', () => {
		const heading = readFileSync('src/shared/ui/SectionHeading.tsx', 'utf8')

		expect(heading).toContain('sm:justify-start')
	})
})
