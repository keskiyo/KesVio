import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../../entities/app'
import { elevationOffer } from '../../lib/elevationOffer'
import type { AppFileActions } from '../../types'

export function useElevationOffer(
	app: AppInfo,
	isHidden: boolean,
	fileActions: AppFileActions,
): boolean {
	const offer = elevationOffer(app, isHidden, fileActions)
	const { canLaunchElevated } = fileActions
	const [answer, setAnswer] = useState<{ id: string; offered: boolean }>()

	useEffect(() => {
		if (offer !== 'ask-windows' || !canLaunchElevated) return
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
	}, [app, canLaunchElevated, offer])

	if (offer === 'offered') return true
	return offer === 'ask-windows' && answer?.id === app.id && answer.offered
}
