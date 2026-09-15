import type {
	SourceErrorKind,
	SourceHealth,
	SourceHealthState,
} from '../model/app.types'

export type SourceStatus =
	| 'up_to_date'
	| 'scanning'
	| 'unavailable'
	| 'incomplete'
	| 'failed'
	| 'not_scanned'
	| 'unknown'

export interface SourceStatusRow {
	key: string
	label: string
	status: SourceStatus
	statusLabel: string
	reason: string | null
	recordCount: number
	lastSuccessAt: number | null
	lastAttemptAt: number | null
	needsAttention: boolean
}

export interface SourceHealthSummary {
	total: number
	attention: SourceStatusRow[]
	latestSuccessAt: number | null
}

const SOURCE_LABELS: Record<string, string> = {
	registry: 'Installed programs',
	'start-menu': 'Start Menu',
	'start-apps': 'Start apps',
	'installer-cache': 'Installer cache',
	steam: 'Steam',
	portable: 'Portable folders',
	windows: 'Windows (legacy)',
}

const STATUS_LABELS: Record<SourceStatus, string> = {
	up_to_date: 'Up to date',
	scanning: 'Scanning…',
	unavailable: 'Unavailable',
	incomplete: 'Incomplete',
	failed: 'Failed',
	not_scanned: 'Not scanned',
	unknown: 'Unknown',
}

const STATE_STATUS: Record<SourceHealthState, SourceStatus> = {
	fresh: 'up_to_date',
	stale: 'unavailable',
	incomplete: 'incomplete',
	failed_without_snapshot: 'failed',
	never_run: 'not_scanned',
	unknown: 'unknown',
}

const ERROR_LABELS: Record<SourceErrorKind, string> = {
	cancelled: 'Cancelled',
	timed_out: 'Timed out',
	entry_limit: 'Entry limit reached',
	provider_failed: 'Did not answer',
	unknown: 'Unknown error',
}

const SHOWING_PREVIOUS = 'showing the last successful result'

export function sourceLabel(key: string): string {
	return SOURCE_LABELS[key] ?? key
}

export function describeSourceHealth(
	health: SourceHealth,
	scanning: boolean,
): SourceStatusRow {
	const status: SourceStatus = scanning
		? 'scanning'
		: (STATE_STATUS[health.state] ?? 'unknown')
	return {
		key: health.key,
		label: sourceLabel(health.key),
		status,
		statusLabel: STATUS_LABELS[status],
		reason: reasonFor(status, health.lastError),
		recordCount: health.recordCount,
		lastSuccessAt: health.lastSuccessAt,
		lastAttemptAt: health.lastAttemptAt,
		needsAttention:
			status === 'unavailable' ||
			status === 'incomplete' ||
			status === 'failed',
	}
}

function reasonFor(
	status: SourceStatus,
	error: SourceErrorKind | null,
): string | null {
	const detail = error ? (ERROR_LABELS[error] ?? ERROR_LABELS.unknown) : null
	switch (status) {
		case 'unavailable':
		case 'incomplete':
			return `${detail ?? ERROR_LABELS.unknown}; ${SHOWING_PREVIOUS}`
		case 'failed':
			return `${detail ?? ERROR_LABELS.unknown}; nothing to show yet`
		default:
			return null
	}
}

export function summarizeSourceHealth(
	rows: SourceStatusRow[],
): SourceHealthSummary {
	let latestSuccessAt: number | null = null
	for (const row of rows) {
		if (
			row.lastSuccessAt !== null &&
			row.lastSuccessAt > (latestSuccessAt ?? -1)
		)
			latestSuccessAt = row.lastSuccessAt
	}
	return {
		total: rows.length,
		attention: rows.filter(row => row.needsAttention),
		latestSuccessAt,
	}
}
