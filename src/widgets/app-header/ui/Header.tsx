import { ArrowUp, Menu } from 'lucide-react'
import { useRef } from 'react'
import { FilterChip } from './FilterChip'
import { ScanButton } from './ScanButton'
import { SearchField } from './SearchField'
import { countLabel } from '../../../shared/lib/countLabel'
import type { HeaderProps } from '../types'

function catalogCountText(primaryAppCount: number, auxiliaryToolCount: number) {
	return `${countLabel(primaryAppCount, 'app')} · ${countLabel(auxiliaryToolCount, 'tool')}`
}

function statusText({
	primaryAppCount,
	auxiliaryToolCount,
	visibleCount,
	query,
	isRefreshing,
	scanProgress,
	bestMatch,
}: Pick<
	HeaderProps,
	| 'primaryAppCount'
	| 'auxiliaryToolCount'
	| 'visibleCount'
	| 'query'
	| 'isRefreshing'
	| 'scanProgress'
> & { bestMatch: string | null }) {
	if (isRefreshing && scanProgress) {
		return `${scanProgress.stage}${scanProgress.location ? ` · ${scanProgress.location}` : ''}${scanProgress.totalRoots > 0 ? ` · ${scanProgress.completedRoots}/${scanProgress.totalRoots}` : ''}`
	}
	if (query.trim() && bestMatch) {
		return countLabel(visibleCount, 'match')
	}
	if (query.trim()) {
		return `${countLabel(visibleCount, 'match')} in ${catalogCountText(primaryAppCount, auxiliaryToolCount)}`
	}
	return `${catalogCountText(primaryAppCount, auxiliaryToolCount)} found`
}

export function Header({
	primaryAppCount,
	auxiliaryToolCount,
	visibleCount,
	query,
	isRefreshing,
	scanProgress,
	activeFilter,
	menuButtonRef,
	searchInputRef,
	onOpenNavigation,
	onQueryChange,
	onRefresh,
	onCancelScan,
	showMenu,
	searchLaunch,
	onScrollToTop,
}: HeaderProps) {
	const fallbackRef = useRef<HTMLInputElement>(null)
	const searchRef = searchInputRef ?? fallbackRef
	const enterTarget =
		query.trim() && !(isRefreshing && scanProgress)
			? searchLaunch?.bestMatch
			: null
	const status = statusText({
		primaryAppCount,
		auxiliaryToolCount,
		visibleCount,
		query,
		isRefreshing,
		scanProgress,
		bestMatch: searchLaunch?.bestMatch ?? null,
	})
	return (
		<header className="app-header-glass sticky top-0 z-300">
			<div className="mx-auto flex w-full max-w-375 items-start gap-3 px-5 pt-4.75 pb-4 sm:px-8">
				{showMenu && (
					<button
						ref={menuButtonRef}
						type="button"
						aria-label="Open navigation"
						onClick={onOpenNavigation}
						className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/85 bg-white/65 text-slate-600 shadow-sm hover:border-violet-400/35 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500"
					>
						<Menu size={19} aria-hidden="true" />
					</button>
				)}
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<div className="min-w-0 flex-1">
						<SearchField
							query={query}
							searchRef={searchRef}
							onQueryChange={onQueryChange}
							searchLaunch={searchLaunch}
						/>
						<div className="app-header-status mt-1.5 flex min-w-0 items-center gap-2 px-1">
							<p
								role="status"
								aria-live="polite"
								aria-atomic="true"
								className={`max-w-[70%] min-w-0 truncate text-xs ${isRefreshing ? 'text-violet-700' : 'text-(--text-muted)'}`}
							>
								{status}
								{enterTarget && (
									<span className="sr-only">{` · Enter opens ${enterTarget}`}</span>
								)}
							</p>
							{activeFilter && (
								<FilterChip filter={activeFilter} />
							)}
							{onScrollToTop && (
								<button
									type="button"
									onClick={event => {
										if (event.detail === 0)
											searchRef.current?.focus({
												preventScroll: true,
											})
										onScrollToTop()
									}}
									aria-label="Back to top"
									className="group ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-(--border-neutral) px-2 py-0.5 text-xs text-(--text-muted) transition-colors hover:border-(--accent) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
								>
									<ArrowUp
										size={14}
										aria-hidden="true"
										className="motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5"
									/>
									Top
								</button>
							)}
						</div>
					</div>
					<ScanButton
						isRefreshing={isRefreshing}
						onRefresh={onRefresh}
						onCancelScan={onCancelScan}
					/>
				</div>
			</div>
		</header>
	)
}
