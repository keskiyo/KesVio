import { useEffect } from 'react'
import { toast } from 'sonner'
import type { DriveOffer, SystemClient } from '../../entities/system'

const hint = () =>
	toast.info(
		'To scan later, add a folder in Settings → Catalog → Additional scan folder, then refresh the catalog.',
	)

export function useDriveScanOffers(
	client: SystemClient,
	refresh: () => Promise<void>,
) {
	useEffect(() => {
		if (!client.getUntrackedRemovableDrives || !client.onVolumesChanged)
			return
		let active = true
		let generation = 0
		let stop: (() => void) | undefined
		const shown = new Set<string>()
		async function scan(drive: DriveOffer) {
			try {
				const folder = await client.pickFolder()
				if (!folder) {
					hint()
					return
				}
				const settings = await client.getSettings()
				const paths = settings.scanSettings.includedPaths
				if (
					!paths.some(
						path => path.toLowerCase() === folder.toLowerCase(),
					)
				)
					await client.setScanSettings({
						...settings.scanSettings,
						includedPaths: [...paths, folder],
					})
				await refresh()
			} catch {
				toast.error(
					`Could not scan ${drive.letter}: drive. Add a folder in Settings → Catalog and refresh.`,
				)
			}
		}
		async function update() {
			const current = ++generation
			try {
				const drives = await client.getUntrackedRemovableDrives!()
				if (!active || current !== generation) return
				const connected = new Set(drives.map(drive => drive.id))
				for (const id of shown)
					if (!connected.has(id)) {
						shown.delete(id)
						toast.dismiss(`drive-scan:${id}`)
					}
				for (const drive of drives) {
					if (shown.has(drive.id)) continue
					shown.add(drive.id)
					toast.info(
						`Removable drive ${drive.label || 'connected'} (${drive.letter}:)`,
						{
							id: `drive-scan:${drive.id}`,
							className: 'drive-scan-offer',
							closeButton: false,
							duration: Infinity,
							description:
								'Scan a folder on this drive for apps?',
							action: {
								label: 'Scan',
								onClick: () => void scan(drive),
							},
							cancel: { label: 'Not now', onClick: hint },
						},
					)
				}
			} catch {
				return
			}
		}
		client
			.onVolumesChanged(() => void update())
			.then(unsubscribe => {
				if (active) {
					stop = unsubscribe
					void update()
				} else unsubscribe()
			})
			.catch(() => {})
		return () => {
			active = false
			stop?.()
			for (const id of shown) toast.dismiss(`drive-scan:${id}`)
		}
	}, [client, refresh])
}
