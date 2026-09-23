import { useEffect } from 'react'
import { toast } from 'sonner'
import type { SystemClient } from '../../entities/system'
import type { UpdaterState } from '../../features/update-app'

interface UpdateFailureNoticeOptions {
	systemClient: Pick<SystemClient, 'openGithub' | 'openRelease'>
	updater: Pick<UpdaterState, 'update' | 'phase' | 'error'>
}

export function useUpdateFailureNotice({
	systemClient,
	updater,
}: UpdateFailureNoticeOptions) {
	const version = updater.update?.version ?? null
	const failure = updater.phase === 'failed' ? updater.error : null

	useEffect(() => {
		if (!failure || !version) return
		toast.error(failure, {
			id: 'update-failure',
			action: {
				label: 'Open release',
				onClick: () =>
					void (
						systemClient.openRelease?.(version) ??
						systemClient.openGithub()
					).catch(() => undefined),
			},
		})
	}, [failure, version, systemClient])
}
