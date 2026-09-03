import { useEffect, useState } from 'react'
import { toAppClientError } from '../../../shared/api/tauri/errors'
import { useCatalogMaintenance } from './useCatalogMaintenance'
import { useSettingsFeedback } from './useSettingsFeedback'
import type { SettingsArea } from './useSettingsFeedback'
import type {
	ScanSettings,
	SystemClient,
	SystemSettings,
} from '../../../entities/system'

interface Options {
	client: SystemClient
	onForceFullScan?: () => Promise<void>
	onResetCatalogCache?: () => Promise<void>
}

type PathKind = 'includedPaths' | 'excludedPaths'

export function useSystemSettings({
	client,
	onForceFullScan,
	onResetCatalogCache,
}: Options) {
	const [settings, setSettings] = useState<SystemSettings | null>(null)
	const [saving, setSaving] = useState(false)
	const { error, errorArea, reportError, clearError } = useSettingsFeedback()
	const maintenance = useCatalogMaintenance({
		reporter: { reportError, clearError },
		onForceFullScan,
		onResetCatalogCache,
	})

	useEffect(() => {
		let active = true
		client
			.getSettings()
			.then(value => {
				if (active) setSettings(value)
			})
			.catch(reason => {
				if (active)
					reportError('settings', toAppClientError(reason).message)
			})
		return () => {
			active = false
		}
	}, [client, reportError])

	async function persist(
		area: SettingsArea,
		apply: () => Promise<Partial<SystemSettings>>,
	) {
		if (!settings || saving) return
		setSaving(true)
		clearError()
		try {
			const patch = await apply()
			setSettings(current =>
				current ? { ...current, ...patch } : current,
			)
		} catch (reason) {
			reportError(area, toAppClientError(reason).message)
		} finally {
			setSaving(false)
		}
	}

	async function saveScanSettings(next: ScanSettings) {
		await persist('discovery', async () => ({
			scanSettings: await client.setScanSettings(next),
		}))
	}

	async function setCloseBehavior(hideToTray: boolean) {
		await persist('settings', async () => ({
			hideToTrayOnClose: await client.setCloseBehavior(hideToTray),
		}))
	}

	function addPath(kind: PathKind, value: string) {
		const trimmed = value.trim()
		if (!settings || !trimmed) return
		if (
			settings.scanSettings[kind].some(
				path => path.toLowerCase() === trimmed.toLowerCase(),
			)
		)
			return
		void saveScanSettings({
			...settings.scanSettings,
			[kind]: [...settings.scanSettings[kind], trimmed],
		})
	}

	function removePath(kind: PathKind, value: string) {
		if (!settings) return
		void saveScanSettings({
			...settings.scanSettings,
			[kind]: settings.scanSettings[kind].filter(path => path !== value),
		})
	}

	return {
		settings,
		error,
		errorArea,
		saving,
		saveScanSettings,
		setCloseBehavior,
		addPath,
		removePath,
		...maintenance,
	}
}
