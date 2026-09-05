import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useRef, useState } from 'react'

export type UpdateCheckStatus =
	'idle' | 'checking' | 'current' | 'available' | 'error'
export type UpdateInstallPhase =
	| 'idle'
	| 'downloading'
	| 'verifying'
	| 'installing'
	| 'restarting'
	| 'failed'

export interface AvailableUpdate {
	version: string
	notes: string | null
	date: string | null
	packageSize: number | null
	releaseUrl: string | null
}

export interface UpdaterState {
	update: AvailableUpdate | null
	installing: boolean
	progress: number | null
	downloadedBytes: number
	totalBytes: number | null
	phase: UpdateInstallPhase
	error: string | null
	status: UpdateCheckStatus
	automaticChecks: boolean
	checkNow(): Promise<void>
	install(): Promise<void>
	dismiss(): void
	setAutomaticChecks(enabled: boolean): void
}

interface Options {
	autoCheck?: boolean
}

const DISMISSED_UPDATE_KEY = 'appnook.dismissed-update-version'
const LAST_CHECK_KEY = 'appnook.last-update-check'
const FAILED_CHECKS_KEY = 'appnook.update-check-failures'
const AUTOMATIC_CHECKS_KEY = 'appnook.automatic-update-checks'
const AUTO_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const MAX_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const MAX_COUNTED_FAILURES = 8
const ACTIVE_UPDATE_PHASES = new Set<UpdateInstallPhase>([
	'downloading',
	'verifying',
	'installing',
	'restarting',
])

function isUpdateInstalling(phase: UpdateInstallPhase): boolean {
	return ACTIVE_UPDATE_PHASES.has(phase)
}

function dismissedVersion(): string | null {
	try {
		return globalThis.localStorage?.getItem(DISMISSED_UPDATE_KEY) ?? null
	} catch {
		return null
	}
}

function rememberDismissedVersion(version: string) {
	try {
		globalThis.localStorage?.setItem(DISMISSED_UPDATE_KEY, version)
	} catch (ignored) {
		void ignored
	}
}

function lastAutomaticCheck(): number {
	try {
		const stored = Number(globalThis.localStorage?.getItem(LAST_CHECK_KEY))
		return Number.isFinite(stored) ? stored : 0
	} catch {
		return 0
	}
}

function rememberCheck(at: number) {
	try {
		globalThis.localStorage?.setItem(LAST_CHECK_KEY, String(at))
	} catch (ignored) {
		void ignored
	}
}

function failedChecks(): number {
	try {
		const stored = Number(
			globalThis.localStorage?.getItem(FAILED_CHECKS_KEY),
		)
		return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
	} catch {
		return 0
	}
}

function rememberFailedChecks(count: number) {
	try {
		globalThis.localStorage?.setItem(FAILED_CHECKS_KEY, String(count))
	} catch (ignored) {
		void ignored
	}
}

function storedAutomaticChecks(): boolean {
	try {
		return globalThis.localStorage?.getItem(AUTOMATIC_CHECKS_KEY) !== 'off'
	} catch {
		return true
	}
}

function rememberAutomaticChecks(enabled: boolean) {
	try {
		globalThis.localStorage?.setItem(
			AUTOMATIC_CHECKS_KEY,
			enabled ? 'on' : 'off',
		)
	} catch (ignored) {
		void ignored
	}
}

function checkInterval(failures: number): number {
	if (failures <= 0) return AUTO_CHECK_INTERVAL_MS
	const backoff =
		AUTO_CHECK_INTERVAL_MS * 2 ** Math.min(failures, MAX_COUNTED_FAILURES)
	return Math.min(backoff, MAX_CHECK_INTERVAL_MS)
}

function automaticCheckIsDue(now: number): boolean {
	const previous = lastAutomaticCheck()
	if (previous <= 0 || previous > now) return true
	return now - previous >= checkInterval(failedChecks())
}

function shouldShowUpdate(
	found: Update | null,
	ignoreDismissed: boolean,
): boolean {
	if (!found) return false
	return ignoreDismissed || dismissedVersion() !== found.version
}

function positiveNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? value
		: null
}

function httpUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null
	try {
		const url = new URL(value)
		return url.protocol === 'https:' ? url.toString() : null
	} catch {
		return null
	}
}

function updateErrorMessage(error: unknown): string {
	const reason = error instanceof Error ? error.message : String(error)
	const normalized = reason.toLowerCase()
	if (normalized.includes('404') || normalized.includes('not found')) {
		return 'The update package is unavailable. Try again later or download it from GitHub.'
	}
	if (
		normalized.includes('download') ||
		normalized.includes('network') ||
		normalized.includes('request')
	) {
		return 'Could not download the update. Check your connection and try again.'
	}
	if (normalized.includes('signature') || normalized.includes('verify')) {
		return 'Update verification failed. The package was not installed.'
	}
	if (
		normalized.includes('access is denied') ||
		normalized.includes('permission') ||
		normalized.includes('administrator') ||
		normalized.includes('run as admin')
	) {
		return 'The update could not write the new version. Reinstall AppNook for the current user or download the installer manually.'
	}
	return 'The update could not be installed. Try again or download it manually.'
}

export function useUpdater(options?: Options): UpdaterState {
	const autoCheck = options?.autoCheck ?? true
	const [available, setAvailable] = useState<Update | null>(null)
	const [phase, setPhase] = useState<UpdateInstallPhase>('idle')
	const [progress, setProgress] = useState<number | null>(null)
	const [downloadedBytes, setDownloadedBytes] = useState(0)
	const [totalBytes, setTotalBytes] = useState<number | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [status, setStatus] = useState<UpdateCheckStatus>('idle')
	const [automaticChecks, setAutomaticChecksState] = useState(
		storedAutomaticChecks,
	)
	const checkPromiseRef = useRef<Promise<Update | null> | null>(null)
	const installInFlightRef = useRef(false)

	const requestCheck = useCallback(() => {
		if (checkPromiseRef.current) return checkPromiseRef.current
		const request = check()
			.then(found => {
				rememberCheck(Date.now())
				rememberFailedChecks(0)
				return found
			})
			.catch((reason: unknown) => {
				rememberCheck(Date.now())
				rememberFailedChecks(failedChecks() + 1)
				throw reason
			})
			.finally(() => {
				if (checkPromiseRef.current === request)
					checkPromiseRef.current = null
			})
		checkPromiseRef.current = request
		return request
	}, [])

	const checkNow = useCallback(async () => {
		setStatus('checking')
		try {
			const found = await requestCheck()
			setAvailable(shouldShowUpdate(found, true) ? found : null)
			setStatus(found ? 'available' : 'current')
		} catch {
			setStatus('error')
		}
	}, [requestCheck])

	const setAutomaticChecks = useCallback((enabled: boolean) => {
		rememberAutomaticChecks(enabled)
		setAutomaticChecksState(enabled)
	}, [])

	useEffect(() => {
		if (!autoCheck || !automaticChecks || !automaticCheckIsDue(Date.now()))
			return
		let active = true
		void (async () => {
			try {
				const found = await requestCheck()
				if (active && shouldShowUpdate(found, false)) {
					setAvailable(found)
					setStatus('available')
				}
			} catch (ignored) {
				void ignored
			}
		})()
		return () => {
			active = false
		}
	}, [autoCheck, automaticChecks, requestCheck])

	const install = useCallback(async () => {
		if (
			installInFlightRef.current ||
			!available ||
			isUpdateInstalling(phase)
		)
			return
		installInFlightRef.current = true
		setError(null)
		setPhase('downloading')
		setProgress(0)
		setDownloadedBytes(0)
		setTotalBytes(null)
		try {
			let total = 0
			let downloaded = 0
			await available.download(event => {
				switch (event.event) {
					case 'Started':
						total = event.data.contentLength ?? 0
						setPhase('downloading')
						setTotalBytes(total || null)
						setProgress(0)
						break
					case 'Progress':
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
						break
					case 'Finished':
						break
				}
			})
			setPhase('verifying')
			setProgress(100)
			await Promise.resolve()
			setPhase('installing')
			await available.install()
			setPhase('restarting')
			await relaunch()
		} catch (error) {
			setPhase('failed')
			setProgress(null)
			setError(updateErrorMessage(error))
		} finally {
			installInFlightRef.current = false
		}
	}, [available, phase])

	const dismiss = useCallback(() => {
		if (available) rememberDismissedVersion(available.version)
		setAvailable(null)
	}, [available])

	return {
		update: available
			? {
					version: available.version,
					notes: available.body ?? null,
					date: available.date ?? null,
					packageSize: positiveNumber(available.rawJson.packageSize),
					releaseUrl: httpUrl(available.rawJson.releaseUrl),
				}
			: null,
		installing: isUpdateInstalling(phase),
		progress,
		downloadedBytes,
		totalBytes,
		phase,
		error,
		status,
		automaticChecks,
		checkNow,
		install,
		dismiss,
		setAutomaticChecks,
	}
}
