import { describe, expect, it } from 'vitest'
import { mergeScenarioImport } from '../../../../src/entities/scenario/lib/scenarioImport'
import type { Scenario } from '../../../../src/entities/scenario'

const scenario = (id: string, name = 'Work'): Scenario => ({
	id,
	name,
	launchIdentities: ['editor'],
	closeIdentities: [],
	createdAt: 1,
})

describe('selective scenario import merge', () => {
	it('copies selected definitions with unique ids/names and clears run history', () => {
		const existing = [scenario('existing')]
		const result = mergeScenarioImport(
			existing,
			[scenario('source'), scenario('skip')],
			[{ sourceId: 'source', replaceId: null }],
			() => 'new',
		)
		expect(result).toMatchObject({
			ok: true,
			scenarios: [
				existing[0],
				{ id: 'new', name: 'Work (2)', lastRunAt: null },
			],
		})
		if (result.ok) expect(result.scenarios[0]).toBe(existing[0])
	})
	it('replaces only an explicitly selected target and preserves its identity and name', () => {
		const result = mergeScenarioImport(
			[scenario('existing', 'Local')],
			[scenario('source')],
			[{ sourceId: 'source', replaceId: 'existing' }],
			() => 'new',
		)
		expect(result).toMatchObject({
			ok: true,
			scenarios: [
				{ id: 'existing', name: 'Local', launchIdentities: ['editor'] },
			],
		})
	})
	it('rejects unknown choices, repeated sources/targets and id collisions atomically', () => {
		const existing = [scenario('existing')]
		const incoming = [scenario('a'), scenario('b')]
		for (const choices of [
			[],
			[{ sourceId: 'missing', replaceId: null }],
			[{ sourceId: 'a', replaceId: 'missing' }],
			[
				{ sourceId: 'a', replaceId: null },
				{ sourceId: 'a', replaceId: null },
			],
			[
				{ sourceId: 'a', replaceId: 'existing' },
				{ sourceId: 'b', replaceId: 'existing' },
			],
		]) {
			expect(
				mergeScenarioImport(existing, incoming, choices, () => 'new')
					.ok,
			).toBe(false)
		}
		expect(
			mergeScenarioImport(
				existing,
				incoming,
				[{ sourceId: 'a', replaceId: null }],
				() => 'existing',
			).ok,
		).toBe(false)
		expect(existing).toHaveLength(1)
	})
	it('enforces the scenario limit while allowing replacement at capacity', () => {
		const existing = Array.from({ length: 50 }, (_, index) =>
			scenario(`local-${index}`),
		)
		expect(
			mergeScenarioImport(
				existing,
				[scenario('a')],
				[{ sourceId: 'a', replaceId: null }],
				() => 'new',
			).ok,
		).toBe(false)
		expect(
			mergeScenarioImport(
				existing,
				[scenario('a')],
				[{ sourceId: 'a', replaceId: 'local-0' }],
				() => 'new',
			).ok,
		).toBe(true)
	})
})
