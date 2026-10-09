import { useEffect, useState } from 'react'
import { type AppInfo, elevationSupport } from '../../../../entities/app'
import type { AppFileActions } from './types'

export function useElevationOffer(
	app: AppInfo,
	isHidden: boolean,
	fileActions: AppFileActions,
): boolean {
	const { launchElevated, canLaunchElevated } = fileActions
	const support = elevationSupport(app)
	const offeredUpfront =
		!isHidden && Boolean(launchElevated) && support === 'available'
	const mustAsk =
		!isHidden &&
		Boolean(launchElevated && canLaunchElevated) &&
		support === 'ask-windows'
	const [answer, setAnswer] = useState<{ id: string; offered: boolean }>()

	useEffect(() => {
		if (!mustAsk || !canLaunchElevated) return
		let active = true
		canLaunchElevated(app).then(
			offered => {
				if (active) setAnswer({ id: app.id, offered })
			},
			() => undefined,
		)
		return () => {
			active = false
		}
	}, [app, canLaunchElevated, mustAsk])

	if (offeredUpfront) return true
	return mustAsk && answer?.id === app.id && answer.offered
}
