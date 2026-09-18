export const ACTION_BUTTON =
	'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'

export const ACTION_BUTTON_PRIMARY = `${ACTION_BUTTON} utility-accent-button text-white focus-visible:outline-violet-400`

export const ACTION_BUTTON_QUIET = `${ACTION_BUTTON} border border-(--border-neutral) hover:bg-(--surface-raised) focus-visible:outline-violet-400`

export const ACTION_BUTTON_NEUTRAL = `${ACTION_BUTTON} border border-slate-300 bg-slate-100 text-slate-700 hover:border-violet-400/45 hover:bg-violet-100/75 focus-visible:outline-violet-500`

export const ACTION_ROW = 'grid gap-2 sm:flex sm:flex-wrap sm:justify-end'

export const DANGER_VARIANT =
	'danger-button border border-red-300/70 text-red-700 hover:bg-red-100 focus-visible:outline-red-400'

export const ICON_BUTTON =
	'grid size-8 shrink-0 place-items-center rounded-lg border border-(--border-neutral) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60'

export const DANGER_ICON_BUTTON = `danger-button ${ICON_BUTTON}`
