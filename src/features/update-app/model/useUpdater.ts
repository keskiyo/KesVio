import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useState } from 'react'
import type { UpdaterState } from '../types'
import { createUpdateResource } from './updateResource'
import { useUpdateCheck } from './useUpdateCheck'
import { useUpdateInstall } from './useUpdateInstall'
import { updatePresentation } from '../lib/updatePresentation'
import { UPDATE_CHECK_TIMEOUT_MS } from './updateTimeouts'

export type {
	AvailableUpdate,
	UpdateCheckStatus,
	UpdateInstallPhase,
	UpdaterState,
} from '../types'

const checkForUpdate = () => check({ timeout: UPDATE_CHECK_TIMEOUT_MS })

export function useUpdater(options?: { autoCheck?: boolean }): UpdaterState {
	const [resource] = useState(createUpdateResource)
	const { available, ...checking } = useUpdateCheck(
		checkForUpdate,
		resource,
		options?.autoCheck ?? true,
	)
	const installation = useUpdateInstall(resource, relaunch)
	return {
		...checking,
		...installation,
		update: updatePresentation(available),
	}
}
