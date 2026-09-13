import { describe, expect, it } from 'vitest'
import {
	driveCategoryFor,
	isDriveCategory,
	staysVisibleWhenEmpty,
} from '../../../../src/entities/category'

describe('driveCategoryFor', () => {
	it('turns a drive root the user added into a category named after the letter', () => {
		expect(driveCategoryFor('F:\\')).toEqual({
			id: 'drive:f',
			label: 'Disk F',
		})
		expect(driveCategoryFor('f:')).toEqual({
			id: 'drive:f',
			label: 'Disk F',
		})
		expect(driveCategoryFor('F:/')).toEqual({
			id: 'drive:f',
			label: 'Disk F',
		})
		expect(driveCategoryFor(' e:\\ ')).toEqual({
			id: 'drive:e',
			label: 'Disk E',
		})
	})

	// A folder inside a drive is a place to look, not a container the user thinks of as one.
	it('gives no category to a folder below a drive root', () => {
		expect(driveCategoryFor('D:\\Apps')).toBeNull()
		expect(driveCategoryFor('D:\\Apps\\')).toBeNull()
		expect(driveCategoryFor('\\\\server\\share')).toBeNull()
	})

	it('gives no category to a record no added folder claims', () => {
		expect(driveCategoryFor(null)).toBeNull()
		expect(driveCategoryFor(undefined)).toBeNull()
		expect(driveCategoryFor('')).toBeNull()
	})

	it('recognises its own categories by id', () => {
		expect(
			isDriveCategory({ id: 'drive:f', label: 'Disk F', builtIn: false }),
		).toBe(true)
		expect(
			isDriveCategory({ id: 'custom:1', label: 'Work', builtIn: false }),
		).toBe(false)
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
				id: 'games',
				label: 'Games',
				builtIn: true,
			}),
		).toBe(false)
	})
})
