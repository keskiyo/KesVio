const ROW_MENU_BUTTON =
	'grid size-8 shrink-0 place-items-center rounded-lg border text-(--text-muted) transition-[opacity,background-color,border-color,color] duration-200 group-hover:opacity-100 hover:border-(--border-neutral) hover:bg-(--surface-inset) hover:text-(--text-primary) focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-(--accent-strong) motion-reduce:transition-none'

export const APP_ROW_PAGE = 'mx-auto w-full max-w-[80rem]'

export const APP_ROW_GRID =
	'grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-2.5'

export const ROW_CHIP =
	'inline-flex max-w-full items-center truncate rounded-md border border-(--border-neutral) bg-(--surface-inset) px-1.5 py-px text-[0.6875rem] leading-4 font-medium text-(--text-muted)'

export function rowMenuButtonClass(menuOpen: boolean): string {
	return `${ROW_MENU_BUTTON} ${menuOpen ? 'border-(--border-neutral) bg-(--surface-inset) text-(--text-primary) opacity-100' : 'border-transparent opacity-60'}`
}
