import { describe, expect, it } from 'vitest'
import { reconcileDriveCategories } from '../../../../src/app/store/driveCategories'
import type { AppInfo } from '../../../../src/entities/app'
import type { CategoryDefinition } from '../../../../src/entities/category'

function stickApp(
	id: string,
	scanFolder: string,
	volumeId: string | null = null,
): AppInfo {
	return {
		id,
		name: id,
		path: `${scanFolder}Tools\\${id}.exe`,
		iconBase64: null,
		category: 'utilities',
		launchKind: 'executable',
		sourceKind: 'portable',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		scanFolder,
		volumeId,
	}
}

function category(
	id: string,
	label: string,
	accent: CategoryDefinition['accent'] = 'cyan',
): CategoryDefinition {
	return { id, label, builtIn: false, accent }
}

const games = { id: 'games', label: 'Games', builtIn: true }

interface DriveReferences {
	collapsedCategories?: string[]
	categoryOverrides?: Record<string, string>
	categoryOverrideIdentities?: Record<string, string>
}

function driveState(
	categories: CategoryDefinition[],
	categoryOrder: string[],
	references: DriveReferences = {},
) {
	return {
		categories,
		categoryOrder,
		collapsedCategories: references.collapsedCategories ?? [],
		categoryOverrides: references.categoryOverrides ?? {},
		categoryOverrideIdentities: references.categoryOverrideIdentities ?? {},
	}
}

describe('reconcileDriveCategories', () => {
	it('creates a volume-keyed category at the top of the order the first time a stick appears', () => {
		const result = reconcileDriveCategories(
			driveState([games], ['games']),
			[
				stickApp('rufus', 'F:\\', '1a2b3c4d'),
				stickApp('hxd', 'F:\\', '1a2b3c4d'),
			],
		)

		expect(result?.categoryOrder).toEqual(['drive:1a2b3c4d', 'games'])
		expect(result?.categories).toEqual([
			games,
			expect.objectContaining({
				id: 'drive:1a2b3c4d',
				label: 'Disk F',
				builtIn: false,
			}),
		])
	})

	it('keeps the letter id for a folder whose volume the backend could not read', () => {
		const result = reconcileDriveCategories(
			driveState([games], ['games']),
			[stickApp('rufus', 'F:\\')],
		)

		expect(result?.categoryOrder).toEqual(['drive:f', 'games'])
	})

	// The stick was Disk F (renamed to Strelec) before volumes were tracked; the first scan that
	// knows the volume must hand the definition over, name, accent and place included.
	it('migrates a legacy letter category to the volume key without losing the name or the place', () => {
		const result = reconcileDriveCategories(
			driveState(
				[
					games,
					category('drive:f', 'Strelec', 'amber'),
					category('custom:1', 'Work'),
				],
				['custom:1', 'drive:f', 'games'],
			),
			[stickApp('rufus', 'F:\\', '1a2b3c4d')],
		)

		expect(result?.categories).toEqual([
			games,
			category('drive:1a2b3c4d', 'Strelec', 'amber'),
			category('custom:1', 'Work'),
		])
		expect(result?.categoryOrder).toEqual([
			'custom:1',
			'drive:1a2b3c4d',
			'games',
		])
	})

	it('relabels a category that still carries the default name when the stick comes back at another letter', () => {
		const result = reconcileDriveCategories(
			driveState(
				[category('drive:1a2b3c4d', 'Disk F')],
				['drive:1a2b3c4d'],
			),
			[stickApp('rufus', 'G:\\', '1a2b3c4d')],
		)

		expect(result?.categories).toEqual([
			category('drive:1a2b3c4d', 'Disk G'),
		])
		expect(result?.categoryOrder).toEqual(['drive:1a2b3c4d'])
	})

	it('leaves a renamed category alone when the letter changes', () => {
		const result = reconcileDriveCategories(
			driveState(
				[category('drive:1a2b3c4d', 'Strelec')],
				['drive:1a2b3c4d'],
			),
			[stickApp('rufus', 'G:\\', '1a2b3c4d')],
		)

		expect(result).toBeNull()
	})

	it('migrates a legacy category and relabels it in one pass when the letter moved as well', () => {
		const result = reconcileDriveCategories(
			driveState([category('drive:g', 'Disk G')], ['drive:g']),
			[stickApp('rufus', 'G:\\', '1a2b3c4d')],
		)

		expect(result?.categories).toEqual([
			category('drive:1a2b3c4d', 'Disk G'),
		])
	})

	// A reformatted stick has a new serial: the old category keeps its marks and waits, the new
	// volume starts its own category rather than inheriting a name it never had.
	it('does not hand an existing volume category to a different volume at the same letter', () => {
		const result = reconcileDriveCategories(
			driveState(
				[category('drive:1a2b3c4d', 'Strelec')],
				['drive:1a2b3c4d'],
			),
			[stickApp('rufus', 'F:\\', '9f9f9f9f')],
		)

		expect(result?.categories).toEqual([
			category('drive:1a2b3c4d', 'Strelec'),
			expect.objectContaining({ id: 'drive:9f9f9f9f', label: 'Disk F' }),
		])
		expect(result?.categoryOrder).toEqual([
			'drive:9f9f9f9f',
			'drive:1a2b3c4d',
		])
	})

	it('removes an absent generated drive category and every stored reference', () => {
		const result = reconcileDriveCategories(
			driveState(
				[games, category('drive:1a2b3c4d', 'Disk F')],
				['drive:1a2b3c4d', 'games'],
				{
					collapsedCategories: ['drive:1a2b3c4d', 'games'],
					categoryOverrides: {
						rufus: 'drive:1a2b3c4d',
						editor: 'games',
					},
					categoryOverrideIdentities: {
						'identity:rufus': 'drive:1a2b3c4d',
						'identity:editor': 'games',
					},
				},
			),
			[],
		)

		expect(result).toEqual(
			driveState([games], ['games'], {
				collapsedCategories: ['games'],
				categoryOverrides: { editor: 'games' },
				categoryOverrideIdentities: {
					'identity:editor': 'games',
				},
			}),
		)
	})

	it('keeps an absent drive category after the user renames it', () => {
		expect(
			reconcileDriveCategories(
				driveState(
					[category('drive:1a2b3c4d', 'Strelec')],
					['drive:1a2b3c4d'],
				),
				[],
			),
		).toBeNull()
	})

	it('answers null when nothing has to change', () => {
		expect(
			reconcileDriveCategories(
				driveState(
					[category('drive:1a2b3c4d', 'Disk F')],
					['drive:1a2b3c4d'],
				),
				[stickApp('rufus', 'F:\\', '1a2b3c4d')],
			),
		).toBeNull()
		expect(
			reconcileDriveCategories(driveState([games], ['games']), []),
		).toBeNull()
	})
})
