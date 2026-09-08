import { useEffect, useRef } from 'react'
import { type Scenario, pickTrayScenarios } from '../../entities/scenario'
import type { SystemClient } from '../../entities/system'

interface TrayScenarioOptions {
	systemClient: Pick<
		SystemClient,
		'setTrayScenarios' | 'setTrayRunning' | 'onTrayScenarioRun'
	>
	scenarios: Scenario[]
	favoriteScenarioIds: string[]
	runningName: string | null
	onRun(id: string): void
}

export function useTrayScenarios({
	systemClient,
	scenarios,
	favoriteScenarioIds,
	runningName,
	onRun,
}: TrayScenarioOptions) {
	const runRef = useRef(onRun)
	const sentRef = useRef<string | null>(null)
	runRef.current = onRun

	useEffect(() => {
		const entries = pickTrayScenarios(scenarios, favoriteScenarioIds)
		const serialized = JSON.stringify(entries)
		if (serialized === sentRef.current) return
		sentRef.current = serialized
		void systemClient.setTrayScenarios?.(entries).catch(() => {})
	}, [favoriteScenarioIds, scenarios, systemClient])

	useEffect(() => {
		void systemClient.setTrayRunning?.(runningName).catch(() => {})
	}, [runningName, systemClient])

	useEffect(() => {
		const listen = systemClient.onTrayScenarioRun
		if (!listen) return
		let active = true
		let stop: (() => void) | undefined
		listen(id => {
			if (active) runRef.current(id)
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
