import { useEffect, type ReactNode } from 'react'
import { scheduleFrontendReady } from './scheduleFrontendReady'

interface FrontendReadyGateProps {
	children: ReactNode
	signal(): void
}

export function FrontendReadyGate({
	children,
	signal,
}: FrontendReadyGateProps) {
	useEffect(() => {
		let active = true
		scheduleFrontendReady(() => {
			if (active) signal()
		})
		return () => {
			active = false
		}
	}, [signal])

	return children
}
