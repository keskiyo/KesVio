import { describe, expect, it } from 'vitest'
import {
	describeSourceHealth,
	sourceLabel,
	summarizeSourceHealth,
} from '../../../../src/entities/app'
import type { SourceHealth } from '../../../../src/entities/app'

function health(overrides: Partial<SourceHealth> = {}): SourceHealth {
	return {
		key: 'start-menu',
		state: 'fresh',
		lastAttemptAt: 1_700_000_100,
		lastSuccessAt: 1_700_000_100,
		consecutiveFailures: 0,
		lastDurationMs: 12,
		lastError: null,
		recordCount: 40,
		...overrides,
	}
}

describe('describeSourceHealth', () => {
	it('names every source for a person rather than by its key', () => {
		expect(sourceLabel('registry')).toBe('Installed programs')
		expect(sourceLabel('start-apps')).toBe('Start apps')
		expect(sourceLabel('installer-cache')).toBe('Installer cache')
		expect(sourceLabel('portable')).toBe('Portable folders')
		expect(sourceLabel('something-new')).toBe('something-new')
	})

	it('maps each backend state to a status, a label and a reason', () => {
		expect(describeSourceHealth(health(), false)).toMatchObject({
			label: 'Start Menu',
			status: 'up_to_date',
			statusLabel: 'Up to date',
			reason: null,
			needsAttention: false,
		})
		expect(
			describeSourceHealth(
				health({ state: 'stale', lastError: 'provider_failed' }),
				false,
			),
		).toMatchObject({
			status: 'unavailable',
			statusLabel: 'Unavailable',
			reason: 'Did not answer; showing the last successful result',
			needsAttention: true,
		})
		expect(
			describeSourceHealth(
				health({ state: 'incomplete', lastError: 'timed_out' }),
				false,
			),
		).toMatchObject({
			status: 'incomplete',
			reason: 'Timed out; showing the last successful result',
			needsAttention: true,
		})
		expect(
			describeSourceHealth(
				health({
					state: 'failed_without_snapshot',
					lastError: 'provider_failed',
					lastSuccessAt: null,
					recordCount: 0,
				}),
				false,
			),
		).toMatchObject({
			status: 'failed',
			statusLabel: 'Failed',
			reason: 'Did not answer; nothing to show yet',
			needsAttention: true,
		})
		expect(
			describeSourceHealth(
				health({
					state: 'never_run',
					lastAttemptAt: null,
					lastSuccessAt: null,
				}),
				false,
			),
		).toMatchObject({
			status: 'not_scanned',
			statusLabel: 'Not scanned',
			reason: null,
			lastSuccessAt: null,
			needsAttention: false,
		})
		expect(
			describeSourceHealth(health({ state: 'unknown' }), false),
		).toMatchObject({ status: 'unknown', statusLabel: 'Unknown' })
	})

	// A source that answered with nothing is healthy; only a source that could not answer is not.
	it('keeps an empty successful result up to date', () => {
		const row = describeSourceHealth(health({ recordCount: 0 }), false)

		expect(row.status).toBe('up_to_date')
		expect(row.recordCount).toBe(0)
		expect(row.needsAttention).toBe(false)
	})

	it('reports scanning for every source while a scan runs', () => {
		const row = describeSourceHealth(
			health({ state: 'stale', lastError: 'provider_failed' }),
			true,
		)

		expect(row.status).toBe('scanning')
		expect(row.statusLabel).toBe('Scanning…')
		expect(row.reason).toBeNull()
		expect(row.needsAttention).toBe(false)
	})

	it('falls back to an unknown error when a failing source carries no reason', () => {
		expect(
			describeSourceHealth(
				health({ state: 'stale', lastError: null }),
				false,
			).reason,
		).toBe('Unknown error; showing the last successful result')
	})
})

describe('summarizeSourceHealth', () => {
	it('counts the rows that need attention and finds the latest success', () => {
		const rows = [
			describeSourceHealth(
				health({ key: 'registry', lastSuccessAt: 50 }),
				false,
			),
			describeSourceHealth(
				health({
					key: 'portable',
					state: 'stale',
					lastError: 'provider_failed',
					lastSuccessAt: 90,
				}),
				false,
			),
			describeSourceHealth(
				health({
					key: 'steam',
					state: 'never_run',
					lastSuccessAt: null,
				}),
				false,
			),
		]

		const summary = summarizeSourceHealth(rows)

		expect(summary.total).toBe(3)
		expect(summary.attention.map(row => row.key)).toEqual(['portable'])
		expect(summary.latestSuccessAt).toBe(90)
	})

	it('has no latest success when no source ever succeeded', () => {
		const summary = summarizeSourceHealth([
			describeSourceHealth(
				health({ state: 'never_run', lastSuccessAt: null }),
				false,
			),
		])

		expect(summary.latestSuccessAt).toBeNull()
		expect(summary.attention).toEqual([])
	})
})
