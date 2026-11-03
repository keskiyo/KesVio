import type { ScanSettings, SystemClient } from '../model/system.types'

export function observeScanSettings(client: SystemClient): SystemClient {
	const listeners = new Set<(settings: ScanSettings) => void>()
	return {
		...client,
		onScanSettingsChanged: handler => {
			listeners.add(handler)
			return () => {
				listeners.delete(handler)
			}
		},
		async setScanSettings(settings) {
			const saved = await client.setScanSettings(settings)
			for (const handler of listeners) handler(saved)
			return saved
		},
	}
}
