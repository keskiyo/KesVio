import { formatDateTime } from '../../shared/lib/dates'

export const HERO_SURFACE =
	'rounded-2xl border border-(--border-neutral) bg-(--surface-panel) p-5 shadow-(--shadow-summary)'

export const SECTION_SURFACE =
	'rounded-2xl border border-(--border-neutral) bg-(--surface-panel) p-5'

export const ADVANCED_SURFACE =
	'rounded-2xl border border-dashed border-(--border-neutral) p-4'

export const DISCLOSURE_BUTTON =
	'flex min-h-11 w-full items-center gap-2 rounded-xl border border-(--border-neutral) bg-(--surface-inset) px-3 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--accent-strong)'

export const ATTENTION_TEXT = 'text-(--category-amber)'

export const ATTENTION_SURFACE =
	'border-(--category-amber)/40 bg-(--category-amber)/8'

export function formatDuration(durationMs: number): string {
	if (durationMs < 1000) return `${durationMs} ms`
	const seconds = durationMs / 1000
	if (seconds < 60) return `${seconds.toFixed(1)} s`
	const minutes = Math.floor(seconds / 60)
	return `${minutes} min ${Math.round(seconds - minutes * 60)} s`
}

export function formatScanTime(completedAt: number): string | null {
	return formatDateTime(new Date(completedAt * 1000))
}
