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
			const { scenarios: current, onRun: run } = latest.current
			for (const scenario of scenariosTriggeredBy(current, volumeIds))
				toast.info(`Drive connected: run ${scenario.name}?`, {
					action: { label: 'Run', onClick: () => run(scenario.id) },
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
