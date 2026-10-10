import { useEffect } from 'react'
import { toast } from 'sonner'
import type { SystemClient } from '../../entities/system'
import type { AppView } from '../../entities/app'

interface ShortcutNoticeOptions {
	systemClient: Pick<SystemClient, 'getSettings'>
	selectView(view: AppView): void
}

export function useShortcutNotice({
	systemClient,
	selectView,
}: ShortcutNoticeOptions) {
	const { getSettings } = systemClient

	useEffect(() => {
		let active = true
		getSettings()
			.then(({ shortcut }) => {
				if (!active || shortcut.available || shortcut.pending) return
				toast.warning(
					`${shortcut.label} is not active — Windows or another app already uses it.`,
					{
						id: 'shortcut-unavailable',
						action: {
							label: 'Choose another',
							onClick: () => selectView('settings'),
						},
					},
				)
			})
			.catch(() => undefined)
		return () => {
			active = false
		}
	}, [getSettings, selectView])
}
