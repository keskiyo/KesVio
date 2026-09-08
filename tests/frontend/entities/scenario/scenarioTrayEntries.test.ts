import { describe, expect, it } from 'vitest'
import {
	MAX_TRAY_SCENARIOS,
	type Scenario,
	pickTrayScenarios,
} from '../../../../src/entities/scenario'

function scenario(value: Partial<Scenario> & Pick<Scenario, 'id'>): Scenario {
	return {
		name: value.id,
		launchIdentities: [],
		closeIdentities: [],
		createdAt: null,
		...value,
	}
}

function ids(entries: { id: string }[]): string[] {
	return entries.map(entry => entry.id)
}

describe('pickTrayScenarios', () => {
	it('orders favorites by their last run without including recent nonfavorites', () => {
		const entries = pickTrayScenarios(
			[
				scenario({ id: 'old', lastRunAt: 1_000 }),
				scenario({ id: 'new', lastRunAt: 2_000 }),
				scenario({ id: 'never' }),
				scenario({ id: 'recent-plain', lastRunAt: 3_000 }),
			],
			['old', 'new', 'never'],
		)

		expect(ids(entries)).toEqual(['new', 'old', 'never'])
	})

	it('leaves slots empty instead of filling them with nonfavorites', () => {
		const entries = pickTrayScenarios(
			[
				scenario({ id: 'ran', lastRunAt: 5_000, createdAt: 1 }),
				scenario({ id: 'old-favorite', createdAt: 2 }),
				scenario({ id: 'newest', createdAt: 9 }),
			],
			['old-favorite'],
		)

		expect(ids(entries)).toEqual(['old-favorite'])
	})

	it('names a scenario once even when it is both run and starred', () => {
		const entries = pickTrayScenarios(
			[scenario({ id: 'work', lastRunAt: 1_000 })],
			['work'],
		)

		expect(ids(entries)).toEqual(['work'])
	})

	it('never hands the tray more entries than its menu shows', () => {
		const many = Array.from(
			{ length: MAX_TRAY_SCENARIOS + 4 },
			(_, index) => scenario({ id: `s${index}`, lastRunAt: index + 1 }),
		)

		const favorites = many.map(entry => entry.id)
		expect(pickTrayScenarios(many, favorites)).toHaveLength(
			MAX_TRAY_SCENARIOS,
		)
		expect(pickTrayScenarios(many, favorites, 0)).toEqual([])
		expect(pickTrayScenarios(many, [])).toEqual([])
		expect(pickTrayScenarios([], [])).toEqual([])
	})

	it('carries the scenario name as the menu label', () => {
		const entries = pickTrayScenarios(
			[scenario({ id: 'work', name: 'Work & Play' })],
			['work'],
		)

		expect(entries).toEqual([
			{ id: 'work', label: 'Work & Play', favorite: true },
		])
	})

	// The menu marks starred scenarios, so it has to be told which ones those are.
	it('reports which of the offered scenarios are starred', () => {
		const entries = pickTrayScenarios(
			[
				scenario({ id: 'starred', name: 'Starred', createdAt: 2 }),
				scenario({ id: 'plain', name: 'Plain', createdAt: 1 }),
			],
			['starred'],
		)

		expect(entries).toEqual([
			{ id: 'starred', label: 'Starred', favorite: true },
		])
	})

	// A star naming nothing must not mark the row that happens to sit in its place.
	it('marks nothing for a favorite id no offered scenario answers to', () => {
		const entries = pickTrayScenarios(
			[scenario({ id: 'work', name: 'Work' })],
			['gone'],
		)

		expect(entries).toEqual([])
	})
})
