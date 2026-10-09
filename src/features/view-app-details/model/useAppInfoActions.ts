import { useCallback, useState } from 'react'
import {
	type AppDetails,
	type AppInfo,
	buildAppReport,
} from '../../../entities/app'
import { copyToClipboard } from '../../../shared/lib/clipboard'

interface AppInfoActionOptions {
	app: AppInfo
	details: AppDetails | null
}

export function useAppInfoActions({ app, details }: AppInfoActionOptions) {
	const [message, setMessage] = useState<string | null>(null)
	const copyReport = useCallback(async () => {
		try {
			await copyToClipboard(buildAppReport(app, details))
			setMessage('Report copied.')
		} catch {
			setMessage('Could not copy the report.')
		}
	}, [app, details])
	return { copyReport, message }
}
