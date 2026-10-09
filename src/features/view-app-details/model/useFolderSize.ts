import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppsClient, FolderSize } from '../../../entities/app'
import { formatBytes } from '../../../shared/lib/bytes'

type FolderSizeState =
	| { status: 'idle' }
	| { status: 'measuring' }
	| { status: 'done'; size: FolderSize }
	| { status: 'failed' }

export function folderSizeLabel(size: FolderSize): string {
	const files = `${size.files.toLocaleString('en-US')} ${size.files === 1 ? 'file' : 'files'}`
	const total = `${formatBytes(size.bytes)} in ${files}`
	return size.complete ? total : `At least ${total}`
}

export function useFolderSize(
	appId: string,
	appsClient: Pick<AppsClient, 'measureAppFolder'>,
) {
	const [state, setState] = useState<FolderSizeState>({ status: 'idle' })
	const currentId = useRef(appId)
	const { measureAppFolder } = appsClient

	useEffect(() => {
		currentId.current = appId
		setState({ status: 'idle' })
		return () => {
			currentId.current = ''
		}
	}, [appId])

	const measure = useCallback(async () => {
		if (!measureAppFolder) return
		const requested = appId
		setState({ status: 'measuring' })
		try {
			const size = await measureAppFolder(requested)
			if (currentId.current === requested)
				setState({ status: 'done', size })
		} catch {
			if (currentId.current === requested) setState({ status: 'failed' })
		}
	}, [appId, measureAppFolder])

	const label =
		state.status === 'done'
			? folderSizeLabel(state.size)
			: state.status === 'failed'
				? 'Could not measure the folder.'
				: null

	return {
		available: Boolean(measureAppFolder),
		measuring: state.status === 'measuring',
		label,
		measure,
	}
}
