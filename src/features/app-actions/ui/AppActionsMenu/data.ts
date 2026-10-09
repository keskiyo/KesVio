import type { CatalogArtifactKind } from '../../../../entities/app'

export const MENU_ITEM_BASE =
	'group relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] focus-visible:outline-2 sm:gap-2.5 sm:px-3 sm:py-2.5 sm:text-sm'

export const MENU_PANEL =
	'motion-panel fixed z-[600] flex max-h-[calc(100vh-1rem)] w-52 max-w-[calc(100vw-1rem)] flex-col gap-0.5 overflow-y-auto rounded-xl border border-slate-200/85 bg-slate-50 p-1.5 text-left text-slate-700 shadow-(--shadow-menu) sm:max-h-[calc(100vh-1.5rem)] sm:w-56 sm:max-w-[calc(100vw-1.5rem)] sm:p-2'

export const ARTIFACT_DESTINATIONS: {
	kind: CatalogArtifactKind
	label: string
}[] = [
	{ kind: 'installer', label: 'Installers' },
	{ kind: 'documentation', label: 'Docs' },
]
