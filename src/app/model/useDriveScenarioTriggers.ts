import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { type Scenario, scenariosTriggeredBy } from '../../entities/scenario'
import type { SystemClient } from '../../entities/system'

interface DriveTriggerOptions {
	systemClient: Pick<SystemClient, 'onVolumesArrived'>
	scenarios: Scenario[]
	onRun(id: string): void
}

export function useDriveScenarioTriggers({
	systemClient,
	scenarios,
	onRun,
}: DriveTriggerOptions) {
	const latest = useRef({ scenarios, onRun })
	latest.current = { scenarios, onRun }

	useEffect(() => {
		const listen = systemClient.onVolumesArrived
		if (!listen) return
		let active = true
		let stop: (() => void) | undefined
		listen(volumeIds => {
			if (!active) return
			for (const scenario of scenariosTriggeredBy(
				latest.current.scenarios,
				volumeIds,
			))
				toast.info(`Drive connected: run ${scenario.name}?`, {
					id: `drive-scenario:${scenario.id}`,
					duration: Number.POSITIVE_INFINITY,
					action: {
						label: 'Run',
						onClick: () => latest.current.onRun(scenario.id),
					},
				})
		})
			.then(unsubscribe => {
				if (active) stop = unsubscribe
				else unsubscribe()
			})
			.catch(() => {})
		return () => {
			active = false
			stop?.()
		}
	}, [systemClient])
}
