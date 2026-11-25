import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { CatalogDiagnostics } from '../../entities/app'
import type { SystemClient } from '../../entities/system'
import { toAppClientError } from '../../shared/api/tauri/errors'
import { reportScanCompletion } from './useScanFeedback'

interface TrayCatalogScanOptions {
	systemClient: Pick<SystemClient, 'onTrayForceFullScan' | 'setTrayScanState'>
	busy: boolean
	onForceFullScan(): Promise<CatalogDiagnostics | null | void>
	onOpenCatalogHealth?(): void
}

export function useTrayCatalogScan({
	systemClient,
	busy,
	onForceFullScan,
	onOpenCatalogHealth,
}: TrayCatalogScanOptions) {
	const current = useRef({ busy, onForceFullScan, onOpenCatalogHealth })
	const pending = useRef(false)
	const ready = useRef(false)
	const stateQueue = useRef<Promise<void>>(Promise.resolve())
	current.current = { busy, onForceFullScan, onOpenCatalogHealth }
	const sendState = useCallback(
		(value: boolean) => {
			stateQueue.current = stateQueue.current
				.then(() => systemClient.setTrayScanState?.(value))
				.catch(() => {})
		},
		[systemClient],
	)

	useEffect(() => {
		let active = true
		let stop: (() => void) | undefined
		async function scan() {
			if (
				!active ||
				!ready.current ||
				pending.current ||
				current.current.busy
			)
				return
			pending.current = true
			sendState(true)
			try {
				const diagnostics = await current.current.onForceFullScan()
				if (active)
					reportScanCompletion(
						diagnostics,
						current.current.onOpenCatalogHealth,
						'Full application scan finished',
					)
			} catch (error) {
				if (active) {
					if (toAppClientError(error).code === 'SCAN_CANCELLED') {
						toast.info('Application scan cancelled')
					} else {
						toast.error(
							'Could not complete the full application scan',
						)
					}
				}
			} finally {
				pending.current = false
				if (active) sendState(current.current.busy)
			}
		}
		void systemClient
			.onTrayForceFullScan?.(() => void scan())
			.then(unsubscribe => {
				if (!active) {
					unsubscribe()
					return
				}
				stop = unsubscribe
				ready.current = true
				sendState(current.current.busy || pending.current)
			})
			.catch(() => {})
		return () => {
			active = false
			ready.current = false
			stop?.()
			sendState(true)
		}
	}, [sendState, systemClient])

	useEffect(() => {
		if (ready.current) {
			sendState(busy || pending.current)
		}
	}, [busy, sendState])
}
