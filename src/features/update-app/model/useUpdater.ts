import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useState } from 'react'
import type { UpdaterState } from '../types'
import { createUpdateResource } from './updateResource'
import { useUpdateCheck } from './useUpdateCheck'
import { useUpdateInstall } from './useUpdateInstall'
import { updatePresentation } from '../lib/updatePresentation'

export type {
	AvailableUpdate,
	UpdateCheckStatus,
	UpdateInstallPhase,
	UpdaterState,
} from '../types'

export function useUpdater(options?: { autoCheck?: boolean }): UpdaterState {
	const [resource] = useState(createUpdateResource)
	const { available, ...checking } = useUpdateCheck(
		check,
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
