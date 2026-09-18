const ROW_MENU_BUTTON =
	'grid size-8 shrink-0 place-items-center rounded-lg border text-(--text-muted) transition-[opacity,background-color,border-color,color] duration-200 group-hover:opacity-100 hover:border-(--border-neutral) hover:bg-(--surface-inset) hover:text-(--text-primary) focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-(--accent-strong) motion-reduce:transition-none'

export function rowMenuButtonClass(menuOpen: boolean): string {
	return `${ROW_MENU_BUTTON} ${menuOpen ? 'border-(--border-neutral) bg-(--surface-inset) text-(--text-primary) opacity-100' : 'border-transparent opacity-60'}`
}
