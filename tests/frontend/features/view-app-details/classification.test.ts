import { describe, expect, it } from 'vitest'
import { buildDetectionRows } from '../../../../src/features/view-app-details/ui/AppInfoDialog/data'
import type { AppInfo } from '../../../../src/entities/app'

const app: AppInfo = {
	id: 'tool',
	name: 'Tool',
	path: 'F:\\tool.exe',
	category: 'other',
	iconBase64: null,
	launchKind: 'executable',
	sourceKind: 'portable',
	platformKind: null,
	description: null,
	version: null,
	publisher: null,
	installLocation: null,
	canUninstall: false,
}
const rows = (value: Partial<AppInfo>) =>
	Object.fromEntries(buildDetectionRows({ ...app, ...value }))

describe('effective classification explanations', () => {
	it('explains drive priority over original artifact and category reasons', () => {
		const result = rows({
			scanFolder: 'F:\\',
			artifactKind: 'installer',
			categoryReasons: ['name=game'],
		})
		expect(result['Shown as']).toBe('Main catalog — grouped by scan drive')
		expect(result.Category).toContain(
			'Manual category changes do not apply',
		)
	})
	it('distinguishes detected artifacts, user placement and promotion', () => {
		expect(rows({ artifactKind: 'installer' })['Shown as']).toBe(
			'Installers & Docs — detected installer',
		)
		expect(rows({ artifactKind: 'documentation' })['Shown as']).toBe(
			'Installers & Docs — detected documentation',
		)
		expect(
			rows({ artifactKind: 'installer', userPlacedArtifact: true })[
				'Shown as'
			],
		).toBe('Installers & Docs — placed here by you')
		expect(
			rows({
				userPromoted: true,
				visibilityReasons: ['maintenance_executable'],
			})['Shown as'],
		).toBe('Main catalog — shown in apps by you')
	})
	it('uses manual category evidence and tolerates missing reasons', () => {
		expect(rows({ categoryReasons: ['user=category'] }).Category).toBe(
			'Category chosen by you',
		)
		expect(rows({ visibilityReasons: [] })['Shown as']).toContain(
			'Classification reason unavailable',
		)
		expect(
			rows({ categoryReasons: ['future=rule'] }).Category,
		).toBeUndefined()
	})
})
