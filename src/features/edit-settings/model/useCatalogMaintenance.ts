import { useRef, useState } from 'react'
import { toAppClientError } from '../../../shared/api/tauri/errors'
import type { SettingsReporter } from './useSettingsFeedback'

export type MaintenanceConfirmation = 'force' | 'reset' | null

interface Options {
	reporter: SettingsReporter
	onForceFullScan?: () => Promise<void>
	onResetCatalogCache?: () => Promise<void>
}

export function useCatalogMaintenance({
	reporter,
	onForceFullScan,
	onResetCatalogCache,
}: Options) {
	const [confirming, setConfirming] = useState<MaintenanceConfirmation>(null)
	const [forcing, setForcing] = useState(false)
	const [resetting, setResetting] = useState(false)
	const inFlight = useRef(false)

	async function run(
		work: (() => Promise<void>) | undefined,
		setPending: (pending: boolean) => void,
	) {
		if (!work || inFlight.current) return
		inFlight.current = true
		setPending(true)
		reporter.clearError()
		try {
			await work()
			setConfirming(null)
		} catch (reason) {
			const clientError = toAppClientError(reason)
			if (clientError.code !== 'SCAN_CANCELLED')
				reporter.reportError('maintenance', clientError.message)
		} finally {
			inFlight.current = false
			setPending(false)
		}
	}

	return {
		confirming,
		setConfirming,
		forcing,
		resetting,
		forceFullScan: () => run(onForceFullScan, setForcing),
		resetCatalogCache: () => run(onResetCatalogCache, setResetting),
	}
}
