const DISMISSED_UPDATE_KEY = 'kesvio.dismissed-update-version'
const LAST_CHECK_KEY = 'kesvio.last-update-check'
const FAILED_CHECKS_KEY = 'kesvio.update-check-failures'
const AUTOMATIC_CHECKS_KEY = 'kesvio.automatic-update-checks'
const AUTO_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const MAX_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const MAX_COUNTED_FAILURES = 8

export function dismissedVersion(): string | null {
	try {
		return globalThis.localStorage?.getItem(DISMISSED_UPDATE_KEY) ?? null
	} catch {
		return null
	}
}

export function rememberDismissedVersion(version: string) {
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

export function rememberCheck(at: number) {
	try {
		globalThis.localStorage?.setItem(LAST_CHECK_KEY, String(at))
	} catch (ignored) {
		void ignored
	}
}

export function failedChecks(): number {
	try {
		const stored = Number(
			globalThis.localStorage?.getItem(FAILED_CHECKS_KEY),
		)
		return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
	} catch {
		return 0
	}
}

export function rememberFailedChecks(count: number) {
	try {
		globalThis.localStorage?.setItem(FAILED_CHECKS_KEY, String(count))
	} catch (ignored) {
		void ignored
	}
}

export function storedAutomaticChecks(): boolean {
	try {
		return globalThis.localStorage?.getItem(AUTOMATIC_CHECKS_KEY) !== 'off'
	} catch {
		return true
	}
}

export function rememberAutomaticChecks(enabled: boolean) {
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

export function automaticCheckIsDue(now: number): boolean {
	const previous = lastAutomaticCheck()
	if (previous <= 0 || previous > now) return true
	return now - previous >= checkInterval(failedChecks())
}
