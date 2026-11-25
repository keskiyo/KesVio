import { CatalogGrid } from './CatalogGrid'
import { SearchScopeHint } from '../SearchScopeHint/SearchScopeHint'
import { Skeleton } from './Skeleton'
import { SearchRecovery } from './SearchRecovery'
import type { AppGridProps } from './types'

export function AppGrid(props: AppGridProps) {
	if (props.isLoading)
		return (
			<section
				aria-label="Loading applications"
				className="app-card-grid"
			>
				{Array.from({ length: 12 }, (_, index) => (
					<Skeleton key={index} />
				))}
			</section>
		)
	const { bestMatch } = props
	const emptySearch = props.hasQuery && !props.apps.length
	return (
		<>
			{bestMatch && (
				<section
					aria-label="Best match"
					className="mb-5 flex min-w-0 items-start gap-2 rounded-xl border border-(--accent)/40 bg-(--surface-inset) px-3 py-2 text-sm"
				>
					<kbd className="shrink-0 rounded border border-(--border-neutral) px-1.5 text-xs leading-5 text-(--text-muted)">
						Enter
					</kbd>
					<div className="min-w-0 wrap-anywhere">
						<span className="font-semibold">{bestMatch.name}</span>
						{props.apps.some(
							app =>
								app.id !== bestMatch.id &&
								app.name.trim().toLowerCase() ===
									bestMatch.name.trim().toLowerCase(),
						) && (
							<span className="ml-1.5 text-xs text-(--text-muted)">
								{bestMatch.sourceKind === 'portable'
									? 'Portable'
									: (bestMatch.publisher ??
										bestMatch.path.split(/[\\/]/).at(-1))}
							</span>
						)}
					</div>
				</section>
			)}
			<CatalogGrid
				{...props}
				emptySearch={
					emptySearch ? <SearchRecovery {...props} /> : undefined
				}
			/>
			{props.hasQuery && !emptySearch && (
				<SearchScopeHint
					counts={props.searchScopeCounts}
					activeView={props.activeView}
					onSelectView={props.onSelectView}
				/>
			)}
		</>
	)
}
