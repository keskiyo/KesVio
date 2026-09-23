import { useEffect, useMemo, useState } from 'react'
import type { SystemClient } from '../../entities/system'
import type { UpdaterState } from '../../features/update-app'

interface NavigationIdentityOptions {
	systemClient: Pick<SystemClient, 'getSettings'>
	updater: Pick<UpdaterState, 'update' | 'phase' | 'progress' | 'install'>
}

export function useNavigationIdentity({
	systemClient,
	updater,
}: NavigationIdentityOptions) {
	const [version, setVersion] = useState<string | null>(null)
	const { getSettings } = systemClient

	useEffect(() => {
		let active = true
		getSettings()
			.then(settings => {
				if (active) setVersion(settings.version)
			})
			.catch(() => undefined)
		return () => {
			active = false
		}
	}, [getSettings])

	const updateVersion = updater.update?.version ?? null
	const { phase, progress, install } = updater
	return useMemo(
		() => ({
			version,
			update: updateVersion
				? {
						version: updateVersion,
						phase,
						progress,
						onInstall: () => void install(),
					}
				: null,
		}),
		[version, updateVersion, phase, progress, install],
	)
}
