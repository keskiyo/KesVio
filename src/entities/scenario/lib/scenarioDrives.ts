import type { AppInfo } from '../../app'
import type { Scenario } from '../model/scenario.types'

export interface DriveTriggerChoice {
	volumeId: string
	label: string
}

export function driveTriggerChoices(apps: AppInfo[]): DriveTriggerChoice[] {
	const drives = new Map<string, { folder: string; count: number }>()
	for (const app of apps) {
		const volumeId = app.volumeId?.trim().toLowerCase()
		if (!volumeId) continue
		const known = drives.get(volumeId)
		if (known) known.count += 1
		else
			drives.set(volumeId, {
				folder: app.scanFolder ?? volumeId,
				count: 1,
			})
	}
	return [...drives.entries()].map(([volumeId, { folder, count }]) => ({
		volumeId,
		label: `${folder} (${count} ${count === 1 ? 'app' : 'apps'})`,
	}))
}

export function scenariosTriggeredBy(
	scenarios: Scenario[],
	volumeIds: string[],
): Scenario[] {
	const arrived = new Set(volumeIds.map(id => id.toLowerCase()))
	return scenarios.filter(
		scenario =>
			scenario.triggerVolumeId !== undefined &&
			arrived.has(scenario.triggerVolumeId.toLowerCase()),
	)
}
