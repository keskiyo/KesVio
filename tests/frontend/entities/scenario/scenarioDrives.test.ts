import { describe, expect, it } from 'vitest'
import type { AppInfo } from '../../../../src/entities/app'
import {
	driveTriggerChoices,
	type Scenario,
	scenariosTriggeredBy,
} from '../../../../src/entities/scenario'

function portable(id: string, volumeId: string | null, scanFolder: string) {
	return {
		id,
		name: id,
		path: `${scanFolder}${id}.exe`,
		iconBase64: null,
		category: 'other',
		launchKind: 'executable',
		sourceKind: 'portable',
		platformKind: 'portable',
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		volumeId,
		scanFolder,
	} as AppInfo
}

function scenario(id: string, triggerVolumeId?: string): Scenario {
	return {
		id,
		name: id,
		launchIdentities: [],
		closeIdentities: [],
		createdAt: null,
		...(triggerVolumeId ? { triggerVolumeId } : {}),
	}
}

describe('drive triggers', () => {
	it('offers each tracked drive once, named by where it is mounted', () => {
		expect(
			driveTriggerChoices([
				portable('a', '1a2b3c4d', 'F:\\'),
				portable('b', '1a2b3c4d', 'F:\\'),
				portable('c', '9f9f9f9f', 'G:\\Tools'),
				portable('d', null, 'D:\\Apps'),
			]),
		).toEqual([
			{ volumeId: '1a2b3c4d', label: 'F:\\ (2 apps)' },
			{ volumeId: '9f9f9f9f', label: 'G:\\Tools (1 app)' },
		])
	})

	it('picks the scenarios bound to a drive that arrived, ignoring case', () => {
		const scenarios = [
			scenario('stick', '1a2b3c4d'),
			scenario('other', '9f9f9f9f'),
			scenario('none'),
		]

		expect(
			scenariosTriggeredBy(scenarios, ['1A2B3C4D']).map(item => item.id),
		).toEqual(['stick'])
		expect(scenariosTriggeredBy(scenarios, [])).toEqual([])
	})
})
