import { useCallback, useEffect, useRef, useState } from 'react'
import type { UpdateInstallPhase } from '../types'
import type { UpdateResource } from './updateResource'
import {
	isUpdateInstalling,
	updateErrorMessage,
} from '../lib/updatePresentation'

export function useUpdateInstall(
	resource: UpdateResource,
	relaunch: () => Promise<void>,
) {
	const [phase, setPhase] = useState<UpdateInstallPhase>('idle')
	const [progress, setProgress] = useState<number | null>(null)
	const [downloadedBytes, setDownloadedBytes] = useState(0)
	const [totalBytes, setTotalBytes] = useState<number | null>(null)
	const [error, setError] = useState<string | null>(null)
	const inFlight = useRef(false)
	const mounted = useRef(false)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const install = useCallback(async () => {
		if (!mounted.current || inFlight.current || isUpdateInstalling(phase))
			return
		const available = resource.acquire()
		if (!available) return
		inFlight.current = true
		setError(null)
		setPhase('downloading')
		setProgress(0)
		setDownloadedBytes(0)
		setTotalBytes(null)
		try {
			let total = 0,
				downloaded = 0
			await available.download(event => {
				if (!mounted.current) return
				if (event.event === 'Started') {
					total = event.data.contentLength ?? 0
					setTotalBytes(total || null)
					setProgress(0)
				} else if (event.event === 'Progress') {
					downloaded += event.data.chunkLength
					setDownloadedBytes(downloaded)
					setProgress(
						total
							? Math.min(
									100,
									Math.round((downloaded / total) * 100),
								)
							: null,
					)
				}
			})
			if (!mounted.current) return
			setPhase('verifying')
			setProgress(100)
			await Promise.resolve()
			if (!mounted.current) return
			setPhase('installing')
			await available.install()
			if (!mounted.current) return
			setPhase('restarting')
			await relaunch()
		} catch (reason) {
			if (mounted.current) {
				setPhase('failed')
				setProgress(null)
				setError(updateErrorMessage(reason))
			}
		} finally {
			inFlight.current = false
			resource.release(available)
		}
	}, [resource, relaunch, phase])
	return {
		phase,
		progress,
		downloadedBytes,
		totalBytes,
		error,
		installing: isUpdateInstalling(phase),
		install,
	}
}
