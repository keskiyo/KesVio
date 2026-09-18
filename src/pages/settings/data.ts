import { ACTION_BUTTON } from '../../shared/ui/buttonVariants'

export const ROW_CHIP = `${ACTION_BUTTON} border border-(--border-neutral) bg-(--surface-inset) shrink-0 text-(--text-primary)`

export const CONFIRM_BUTTON =
	'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'

export const CANCEL_BUTTON = `${CONFIRM_BUTTON} border border-slate-300/80 bg-white/60 text-slate-700 hover:bg-violet-100/70 focus-visible:outline-violet-400`

export const SETTINGS_SURFACE =
	'settings-surface mt-5 overflow-hidden rounded-2xl border border-white/85 bg-white/58'

export const SETTINGS_SECTION_LABEL =
	'border-b border-slate-200 bg-slate-50/35 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'
