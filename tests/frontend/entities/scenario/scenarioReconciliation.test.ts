import { describe, expect, it } from 'vitest'
import {
	reconcileScenarios,
	type Scenario,
} from '../../../../src/entities/scenario'
import type { AppInfo } from '../../../../src/entities/app'

function app(value: Partial<AppInfo> & Pick<AppInfo, 'id'>): AppInfo {
	return {
		name: value.id,
		path: `C:\\Apps\\${value.id}.exe`,
		category: 'other',
		iconBase64: null,
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		...value,
	}
}

function scenario(value: Partial<Scenario> = {}): Scenario {
	return {
		id: 'scenario-1',
		name: 'Development',
		launchIdentities: [],
		closeIdentities: [],
		launchAppSnapshots: {},
		closeAppSnapshots: {},
		createdAt: 1,
		...value,
	}
}

const currentCode = app({
	id: 'code-current',
	name: 'Visual Studio Code',
	preferenceIdentity: 'preference:current-code',
})

describe('reconcileScenarios', () => {
	it('rekeys an entry whose identity an update replaced', () => {
		const reconciled = reconcileScenarios(
			[
				scenario({
					launchIdentities: ['preference:old-code'],
					launchAppSnapshots: {
						'preference:old-code': {
							name: 'Visual Studio Code',
							iconBase64: null,
						},
					},
				}),
			],
			[currentCode],
		)

		expect(reconciled?.[0]).toMatchObject({
			launchIdentities: ['preference:current-code'],
			launchAppSnapshots: {
				'preference:current-code': {
					name: 'Visual Studio Code',
					iconBase64: null,
				},
			},
		})
		expect(reconciled?.[0].launchAppSnapshots).not.toHaveProperty(
			'preference:old-code',
		)
	})

	it('leaves an unchanged scenario as the very same object', () => {
		const unchanged = scenario({
			launchIdentities: ['preference:current-code'],
		})

		expect(reconcileScenarios([unchanged], [currentCode])).toBeNull()
	})

	it('keeps an entry the catalog cannot explain at all', () => {
		const stale = scenario({
			launchIdentities: ['preference:gone'],
			launchAppSnapshots: {
				'preference:gone': { name: 'Removed App', iconBase64: null },
			},
		})

		expect(reconcileScenarios([stale], [currentCode])).toBeNull()
	})

	it('refuses to rekey when the remembered name is no longer unique', () => {
		const twin = app({
			id: 'code-twin',
			name: 'Visual Studio Code',
			preferenceIdentity: 'preference:twin-code',
		})
		const ambiguous = scenario({
			launchIdentities: ['preference:old-code'],
			launchAppSnapshots: {
				'preference:old-code': {
					name: 'Visual Studio Code',
					iconBase64: null,
				},
			},
		})

		expect(reconcileScenarios([ambiguous], [currentCode, twin])).toBeNull()
	})

	it('drops the stale row instead of listing the same app twice', () => {
		const duplicated = scenario({
			launchIdentities: [
				'preference:current-code',
				'preference:old-code',
			],
			launchAppSnapshots: {
				'preference:old-code': {
					name: 'Visual Studio Code',
					iconBase64: null,
				},
			},
		})

		const reconciled = reconcileScenarios([duplicated], [currentCode])

		expect(reconciled?.[0].launchIdentities).toEqual([
			'preference:current-code',
		])
		expect(reconciled?.[0].launchAppSnapshots).toEqual({})
	})

	it('never moves an entry onto an identity the opposite list already holds', () => {
		const crossed = scenario({
			launchIdentities: ['preference:current-code'],
			closeIdentities: ['preference:old-code'],
			closeAppSnapshots: {
				'preference:old-code': {
					name: 'Visual Studio Code',
					iconBase64: null,
				},
			},
		})

		const reconciled = reconcileScenarios([crossed], [currentCode])

		expect(reconciled?.[0].launchIdentities).toEqual([
			'preference:current-code',
		])
		expect(reconciled?.[0].closeIdentities).toEqual([])
	})

	it('rewrites nothing when a scan returned no applications', () => {
		const kept = scenario({
			launchIdentities: ['preference:old-code'],
			launchAppSnapshots: {
				'preference:old-code': {
					name: 'Visual Studio Code',
					iconBase64: null,
				},
			},
		})

		expect(reconcileScenarios([kept], [])).toBeNull()
	})
})
