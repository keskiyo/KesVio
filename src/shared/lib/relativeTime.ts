const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function relativeTimeLabel(
	timestamp: number | null | undefined,
	now: number = Date.now(),
): string | null {
	if (typeof timestamp !== 'number' || !Number.isFinite(timestamp))
		return null
	if (timestamp <= 0) return null
	const elapsed = now - timestamp
	if (elapsed < 0) return 'just now'
	if (elapsed < MINUTE) return 'just now'
	if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
	if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
	if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`
	return new Date(timestamp).toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
	})
}
