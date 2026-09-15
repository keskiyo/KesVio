import { describe, expect, it } from 'vitest'
import {
	identityRekeys,
	rekeyRecord,
} from '../../../../src/app/store/identityRekey'
import type { AppInfo } from '../../../../src/entities/app'

function record(id: string, preferenceIdentity: string | null): AppInfo {
	return {
		id,
		name: id,
		path: `F:\\Tools\\${id}.exe`,
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
		preferenceIdentity,
	}
}

describe('identityRekeys', () => {
	// The first scan after an update keeps every id and hands out volume-anchored identities;
	// the id is the bridge that lets identity-keyed data follow.
	it('maps an old identity to the new one when the same id comes back with another identity', () => {
		const rekeys = identityRekeys(
			[
				record('rufus', 'identity:letter'),
				record('hxd', 'identity:same'),
			],
			[
				record('rufus', 'identity:volume'),
				record('hxd', 'identity:same'),
			],
		)

		expect([...rekeys]).toEqual([['identity:letter', 'identity:volume']])
	})

	it('maps nothing for new ids, dropped ids, an empty catalog or an untouched identity', () => {
		expect(
			identityRekeys([], [record('rufus', 'identity:volume')]).size,
		).toBe(0)
		expect(
			identityRekeys(
				[record('rufus', 'identity:letter')],
				[record('rufus-at-g', 'identity:letter')],
			).size,
		).toBe(0)
		expect(
			identityRekeys(
				[record('rufus', 'identity:letter')],
				[record('rufus', 'identity:letter')],
			).size,
		).toBe(0)
	})
})

describe('rekeyRecord', () => {
	const rekeys = new Map([['identity:letter', 'identity:volume']])

	it('moves an entry to its new key and drops the old one', () => {
		expect(
			rekeyRecord(
				{ 'identity:letter': ['usb'], 'identity:other': ['x'] },
				rekeys,
			),
		).toEqual({ 'identity:volume': ['usb'], 'identity:other': ['x'] })
	})

	it('never overwrites an entry the new key already has', () => {
		expect(
			rekeyRecord(
				{ 'identity:letter': 100, 'identity:volume': 200 },
				rekeys,
			),
		).toEqual({ 'identity:letter': 100, 'identity:volume': 200 })
	})

	it('returns the same object when nothing moves', () => {
		const untouched = { 'identity:other': 1 }

		expect(rekeyRecord(untouched, rekeys)).toBe(untouched)
		expect(rekeyRecord(untouched, new Map())).toBe(untouched)
	})
})
