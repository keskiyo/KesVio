import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	ACTION_BUTTON,
	ACTION_BUTTON_PRIMARY,
	ACTION_BUTTON_QUIET,
	ROW_CHIP,
} from '../../../src/pages/settings/data'

const read = file => readFileSync(file, 'utf8')

const general = read('src/pages/settings/ui/sections/GeneralSettings.tsx')
const updates = read(
	'src/pages/settings/ui/sections/SettingsUpdateControls.tsx',
)
const density = read('src/pages/settings/ui/components/DensityControl.tsx')
const cardActions = [
	'src/pages/settings/ui/sections/CatalogMaintenance.tsx',
	'src/pages/settings/ui/sections/PreferencesBackup/PreferencesBackup.tsx',
	'src/pages/settings/ui/sections/UnclassifiedApps/UnclassifiedApps.tsx',
].map(read)

/**
 * The trailing control of a settings row used to be written out at each call site, so the shortcut
 * chip stood 30px tall with an `lg` radius, `Open` 34px, and the density control 38px with an `xl`
 * radius — three heights and two corner radii down one column. Every one of them now derives from
 * `ACTION_BUTTON`, which is the shape the card actions below already used.
 */
describe('settings row controls', () => {
	it('derives every variant from the one shared shape', () => {
		for (const [name, variant] of Object.entries({
			ACTION_BUTTON_PRIMARY,
			ACTION_BUTTON_QUIET,
			ROW_CHIP,
		})) {
			expect(variant, `${name} extends ACTION_BUTTON`).toContain(
				ACTION_BUTTON,
			)
		}
	})

	it('gives each trailing control in a row that shape', () => {
		expect(general).toContain('ROW_CHIP')
		expect(general).toContain('ACTION_BUTTON_PRIMARY')
		expect(updates).toContain('ACTION_BUTTON_PRIMARY')
		expect(updates).toContain('ACTION_BUTTON_QUIET')
	})

	it('lets the density choices fill the settings row', () => {
		expect(density).toContain('min-h-11 w-full grid-cols-3')
		expect(density).not.toMatch(/\b(?:ml-auto|w-80|max-w-full)\b/)
	})

	it('leaves no hand-written button geometry in those rows', () => {
		for (const source of [general, updates]) {
			expect(source).not.toMatch(/rounded-(lg|xl) px-[\d.]+ py-[\d.]+/)
			expect(source).not.toMatch(/\bmin-h-\d/)
		}
	})

	// Dialog confirmations keep their own smaller `CONFIRM_BUTTON` shape; this is only about the
	// full-size card action, which was the same string written out three times.
	it('keeps the card actions on the shared shape rather than a copy of it', () => {
		for (const source of cardActions) {
			expect(source).not.toContain(
				'${ACTION_BUTTON} utility-accent-button',
			)
		}
	})
})
