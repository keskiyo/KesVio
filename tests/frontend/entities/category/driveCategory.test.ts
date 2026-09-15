import { describe, expect, it } from 'vitest'
import {
	driveCategoryFor,
	isDefaultDriveLabel,
	isDriveCategory,
	isDriveCategoryId,
	staysVisibleWhenEmpty,
} from '../../../../src/entities/category'

describe('driveCategoryFor', () => {
	it('turns a drive root the user added into a category named after the letter', () => {
		expect(driveCategoryFor({ scanFolder: 'F:\\' })).toEqual({
			id: 'drive:f',
			label: 'Disk F',
			letterId: 'drive:f',
		})
		expect(driveCategoryFor({ scanFolder: 'f:' })).toEqual({
			id: 'drive:f',
			label: 'Disk F',
			letterId: 'drive:f',
		})
		expect(driveCategoryFor({ scanFolder: 'F:/' })).toEqual({
			id: 'drive:f',
			label: 'Disk F',
			letterId: 'drive:f',
		})
		expect(driveCategoryFor({ scanFolder: ' e:\\ ' })).toEqual({
			id: 'drive:e',
			label: 'Disk E',
			letterId: 'drive:e',
		})
	})

	// The volume behind the letter is the container; the letter is only where it is mounted today.
	it('keys the category by the volume when the record carries one and labels it by the letter', () => {
		expect(
			driveCategoryFor({ scanFolder: 'G:\\', volumeId: '1a2b3c4d' }),
		).toEqual({
			id: 'drive:1a2b3c4d',
			label: 'Disk G',
			letterId: 'drive:g',
		})
		expect(
			driveCategoryFor({ scanFolder: 'F:\\', volumeId: '1A2B3C4D' }),
		).toEqual({
			id: 'drive:1a2b3c4d',
			label: 'Disk F',
			letterId: 'drive:f',
		})
	})

	it('falls back to the letter when the volume key is not one the backend would write', () => {
		expect(
			driveCategoryFor({ scanFolder: 'F:\\', volumeId: 'not-a-key' })?.id,
		).toBe('drive:f')
		expect(driveCategoryFor({ scanFolder: 'F:\\', volumeId: '' })?.id).toBe(
			'drive:f',
		)
		expect(
			driveCategoryFor({ scanFolder: 'F:\\', volumeId: null })?.id,
		).toBe('drive:f')
	})

	// A folder inside a drive is a place to look, not a container the user thinks of as one.
	it('gives no category to a folder below a drive root', () => {
		expect(driveCategoryFor({ scanFolder: 'D:\\Apps' })).toBeNull()
		expect(driveCategoryFor({ scanFolder: 'D:\\Apps\\' })).toBeNull()
		expect(driveCategoryFor({ scanFolder: '\\\\server\\share' })).toBeNull()
		expect(
			driveCategoryFor({ scanFolder: 'D:\\Apps', volumeId: '1a2b3c4d' }),
		).toBeNull()
	})

	it('gives no category to a record no added folder claims', () => {
		expect(driveCategoryFor(null)).toBeNull()
		expect(driveCategoryFor(undefined)).toBeNull()
		expect(driveCategoryFor({ scanFolder: '' })).toBeNull()
		expect(driveCategoryFor({ volumeId: '1a2b3c4d' })).toBeNull()
	})

	it('recognises its own categories by id, letter-keyed and volume-keyed alike', () => {
		expect(
			isDriveCategory({ id: 'drive:f', label: 'Disk F', builtIn: false }),
		).toBe(true)
		expect(isDriveCategoryId('drive:1a2b3c4d')).toBe(true)
		expect(isDriveCategoryId('drive:1A2B3C4D')).toBe(false)
		expect(isDriveCategoryId('drive:1a2b3c4')).toBe(false)
		expect(isDriveCategoryId('drive:fg')).toBe(false)
		expect(
			isDriveCategory({ id: 'custom:1', label: 'Work', builtIn: false }),
		).toBe(false)
	})

	it('tells a label it wrote itself from one the user typed', () => {
		expect(isDefaultDriveLabel('Disk F')).toBe(true)
		expect(isDefaultDriveLabel('Disk f')).toBe(false)
		expect(isDefaultDriveLabel('Strelec')).toBe(false)
		expect(isDefaultDriveLabel('Disk F ')).toBe(false)
	})

	// A category the user made stays on screen so they can move apps into it; a drive category
	// exists only because of the apps found on the drive, so without them it is a pulled stick.
	it('does not keep an empty drive category on screen the way a user category stays', () => {
		expect(
			staysVisibleWhenEmpty({
				id: 'custom:1',
				label: 'Work',
				builtIn: false,
			}),
		).toBe(true)
		expect(
			staysVisibleWhenEmpty({
				id: 'drive:f',
				label: 'Disk F',
				builtIn: false,
			}),
		).toBe(false)
		expect(
			staysVisibleWhenEmpty({
				id: 'drive:1a2b3c4d',
				label: 'Disk F',
				builtIn: false,
			}),
		).toBe(false)
		expect(
			staysVisibleWhenEmpty({
				id: 'games',
				label: 'Games',
				builtIn: true,
			}),
		).toBe(false)
	})
})
