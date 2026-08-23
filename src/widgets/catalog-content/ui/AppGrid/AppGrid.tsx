import { CatalogGrid } from './CatalogGrid'
import { SearchScopeHint } from '../SearchScopeHint/SearchScopeHint'
import { Skeleton } from './Skeleton'
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
	return (
		<>
			<CatalogGrid {...props} />
			{props.hasQuery && (
				<SearchScopeHint
					counts={props.searchScopeCounts}
					activeView={props.activeView}
					onSelectView={props.onSelectView}
				/>
			)}
		</>
	)
}
