import { describe, expect, it } from 'vitest'
import {
	type Scenario,
	countScenarioFilters,
	filterScenarios,
	sortScenarios,
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

const ran = scenario({
	id: 'ran',
	name: 'Ran',
	lastRunAt: 5_000,
	createdAt: 1,
	launchIdentities: ['steam'],
})
const starred = scenario({ id: 'starred', name: 'Starred', createdAt: 3 })
const broken = scenario({
	id: 'broken',
	name: 'Broken',
	createdAt: 2,
	closeIdentities: ['gone'],
})
const all = [ran, starred, broken]

function ids(scenarios: Scenario[]): string[] {
	return scenarios.map(entry => entry.id)
}

describe('countScenarioFilters', () => {
	it('counts what each filter would show', () => {
		expect(countScenarioFilters(all, ['starred'])).toEqual({
			all: 3,
			favorites: 1,
			recent: 1,
		})
	})

	it('counts nothing for an empty list', () => {
		expect(countScenarioFilters([], ['starred'])).toEqual({
			all: 0,
			favorites: 0,
			recent: 0,
		})
	})

	// A star naming a scenario the list no longer holds must not inflate the chip.
	it('ignores a favorite id no scenario answers to', () => {
		expect(countScenarioFilters(all, ['starred', 'gone']).favorites).toBe(1)
	})
})

describe('filterScenarios', () => {
	it('keeps everything under the all filter', () => {
		expect(ids(filterScenarios(all, 'all', ['starred']))).toEqual([
			'ran',
			'starred',
			'broken',
		])
	})

	it('keeps only what each filter names', () => {
		expect(ids(filterScenarios(all, 'favorites', ['starred']))).toEqual([
			'starred',
		])
		expect(ids(filterScenarios(all, 'recent', ['starred']))).toEqual([
			'ran',
		])
	})

	it('leaves the given list untouched', () => {
		filterScenarios(all, 'favorites', ['starred'])

		expect(ids(all)).toEqual(['ran', 'starred', 'broken'])
	})
})

describe('sortScenarios', () => {
	it('puts what ran last first, then the newest of the rest', () => {
		expect(ids(sortScenarios(all, 'recent'))).toEqual([
			'ran',
			'starred',
			'broken',
		])
	})

	it('orders by name and by creation date on request', () => {
		expect(ids(sortScenarios(all, 'name'))).toEqual([
			'broken',
			'ran',
			'starred',
		])
		expect(ids(sortScenarios(all, 'newest'))).toEqual([
			'starred',
			'broken',
			'ran',
		])
	})

	it('reverses every order on request', () => {
		expect(ids(sortScenarios(all, 'recent', true))).toEqual([
			'broken',
			'starred',
			'ran',
		])
		expect(ids(sortScenarios(all, 'name', true))).toEqual([
			'starred',
			'ran',
			'broken',
		])
		expect(ids(sortScenarios(all, 'newest', true))).toEqual([
			'ran',
			'broken',
			'starred',
		])
	})

	it('leaves the given list untouched', () => {
		sortScenarios(all, 'name')
		sortScenarios(all, 'name', true)

		expect(ids(all)).toEqual(['ran', 'starred', 'broken'])
	})
})
