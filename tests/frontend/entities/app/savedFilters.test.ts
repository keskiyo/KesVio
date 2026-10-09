import { describe, expect, it } from 'vitest'
import {
	EMPTY_CRITERIA,
	applySavedFilter,
	matchesSavedFilter,
	normalizeCriteria,
	normalizeSavedFilter,
	type AppInfo,
} from '../../../../src/entities/app'

const editor: AppInfo = {
	id: 'editor',
	name: 'Editor',
	path: 'C:\\editor.exe',
	iconBase64: null,
	category: 'development',
	launchKind: 'executable',
	sourceKind: 'portable',
	platformKind: null,
	description: null,
	version: null,
	publisher: 'Example',
	installLocation: null,
	canUninstall: false,
	targetAvailability: 'target.present',
}

describe('saved filter predicates', () => {
	it('uses AND between fields and OR within a field', () => {
		const criteria = {
			...EMPTY_CRITERIA,
			sources: ['portable', 'registry'] as const,
			publishers: ['example', 'other'],
		}
		expect(
			matchesSavedFilter(
				editor,
				{ ...criteria, sources: [...criteria.sources] },
				undefined,
				0,
			),
		).toBe(true)
		expect(
			matchesSavedFilter(
				{ ...editor, publisher: 'No match' },
				{ ...criteria, sources: [...criteria.sources] },
				undefined,
				0,
			),
		).toBe(false)
	})
	// The Steam client is a Start Menu shortcut, its games come from the Steam library; a user
	// choosing "Steam" means both, so the platform the backend derives joins the discovery source.
	it('lets the Steam source match the Steam client through its platform', () => {
		const steamClient: AppInfo = {
			...editor,
			id: 'steam',
			name: 'Steam',
			sourceKind: 'start_menu',
			platformKind: 'steam',
			publisher: 'Valve Corporation',
		}
		const steamGame: AppInfo = {
			...editor,
			id: 'game',
			sourceKind: 'steam',
			platformKind: 'steam',
		}
		const shortcut: AppInfo = {
			...editor,
			id: 'shortcut',
			sourceKind: 'start_menu',
		}
		const steamOnly = { ...EMPTY_CRITERIA, sources: ['steam' as const] }

		expect(matchesSavedFilter(steamClient, steamOnly, undefined, 0)).toBe(
			true,
		)
		expect(matchesSavedFilter(steamGame, steamOnly, undefined, 0)).toBe(
			true,
		)
		expect(matchesSavedFilter(shortcut, steamOnly, undefined, 0)).toBe(
			false,
		)
		expect(
			matchesSavedFilter(
				steamClient,
				{ ...EMPTY_CRITERIA, sources: ['start_menu'] },
				undefined,
				0,
			),
		).toBe(true)
	})
	it('reuses the current scope for empty criteria', () => {
		const apps = [editor]
		expect(applySavedFilter(apps, EMPTY_CRITERIA, {}, 0)).toBe(apps)
	})
	it('excludes missing, invalid and future dates from a relative filter', () => {
		const criteria = { ...EMPTY_CRITERIA, addedWithinDays: 1 }
		for (const stamp of [undefined, NaN, Infinity, 200_000_001]) {
			expect(
				matchesSavedFilter(editor, criteria, stamp, 200_000_000),
			).toBe(false)
		}
		expect(
			matchesSavedFilter(
				editor,
				criteria,
				200_000_000 - 86_400_000,
				200_000_000,
			),
		).toBe(true)
		expect(
			matchesSavedFilter(
				editor,
				criteria,
				200_000_000 - 86_400_001,
				200_000_000,
			),
		).toBe(false)
	})
	it('normalizes malformed imported criteria and deduplicates values', () => {
		expect(
			normalizeCriteria({
				sources: ['portable', 'invalid', 'portable'],
				publishers: [' Example ', 'example'],
				availability: ['present', 'x'],
				addedWithinDays: -1,
			}),
		).toEqual({
			sources: ['portable'],
			publishers: ['Example'],
			availability: ['present'],
			addedWithinDays: null,
			unusedForDays: null,
		})
		expect(normalizeSavedFilter({ id: 'invalid', name: 'Work' })).toBeNull()
	})
	it('reads the unused period of filters saved before it existed as unset', () => {
		expect(
			normalizeCriteria({ addedWithinDays: 7 }).unusedForDays,
		).toBeNull()
		expect(normalizeCriteria({ unusedForDays: 90 }).unusedForDays).toBe(90)
		expect(normalizeCriteria({ unusedForDays: 0 }).unusedForDays).toBeNull()
		expect(
			normalizeCriteria({ unusedForDays: 2.5 }).unusedForDays,
		).toBeNull()
	})
	it('never calls an app unused without a moment to count from', () => {
		const criteria = { ...EMPTY_CRITERIA, unusedForDays: 30 }
		expect(matchesSavedFilter(editor, criteria, undefined, 1e12)).toBe(
			false,
		)
		expect(matchesSavedFilter(editor, criteria, undefined, 1e12, 1)).toBe(
			true,
		)
		expect(
			matchesSavedFilter(editor, criteria, undefined, 1e12, 1e12 + 5),
		).toBe(false)
	})
	it('does not treat an unknown target state as verified', () => {
		expect(
			matchesSavedFilter(
				{ ...editor, targetAvailability: null },
				{ ...EMPTY_CRITERIA, availability: ['present'] },
				undefined,
				0,
			),
		).toBe(false)
	})
})
