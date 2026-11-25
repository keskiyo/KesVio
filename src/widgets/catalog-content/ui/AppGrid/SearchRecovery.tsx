import { SearchX } from 'lucide-react'
import { assessCatalogHealth } from '../../../../entities/app'
import { SearchScopeHint } from '../SearchScopeHint/SearchScopeHint'
import type { AppGridProps } from './types'

const RECOVERY_ACTION =
	'inline-flex min-h-9 items-center rounded-lg px-2 py-1 text-sm text-(--accent-strong) underline-offset-4 hover:bg-(--surface-raised) hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)'

export function SearchRecovery({
	activeView,
	searchScopeCounts,
	onSelectView,
	onClearFilter,
	onConfigureFolders,
	diagnostics,
	isRefreshing,
}: Pick<
	AppGridProps,
	| 'activeView'
	| 'searchScopeCounts'
	| 'onSelectView'
	| 'onClearFilter'
	| 'onConfigureFolders'
	| 'diagnostics'
	| 'isRefreshing'
>) {
	const health = assessCatalogHealth(
		diagnostics ?? null,
		isRefreshing ?? false,
	)
	return (
		<section
			aria-label="No apps found"
			className="space-y-3 rounded-xl border border-(--border-neutral) bg-(--surface-inset) p-4"
		>
			<h2 className="flex items-center gap-2 text-base font-semibold">
				<SearchX size={18} aria-hidden="true" />
				No apps found
			</h2>
			<SearchScopeHint
				inline
				counts={searchScopeCounts}
				activeView={activeView}
				onSelectView={onSelectView}
				fallback={
					onClearFilter ? null : (
						<details className="text-sm">
							<summary className="w-fit cursor-pointer rounded text-(--accent-strong) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)">
								Find missing app
							</summary>
							<p className="mt-3 text-(--text-muted)">
								Check the last scan or choose the folder where
								the app is installed.
							</p>
							<p className="mt-2 text-(--text-muted)">
								{health.state === 'no_diagnostics'
									? 'No scan status available yet.'
									: health.state === 'scanning'
										? 'A catalog scan is in progress.'
										: health.state === 'attention'
											? 'The last scan needs attention.'
											: health.state === 'unverified'
												? 'Source status is unavailable for the last scan.'
												: 'The last scan reported no source problems.'}
							</p>
							<p className="mt-2 text-(--text-muted)">
								Full scans include fixed drives when enabled.
								Excluded folders and scan limits can affect
								results.
							</p>
							<div className="mt-2 flex flex-wrap gap-1">
								<button
									type="button"
									className={RECOVERY_ACTION}
									onClick={() =>
										onSelectView('catalog_health')
									}
								>
									Open Catalog Health
								</button>
								{onConfigureFolders && (
									<button
										type="button"
										className={RECOVERY_ACTION}
										onClick={onConfigureFolders}
									>
										Configure scan folders
									</button>
								)}
							</div>
						</details>
					)
				}
			/>
			{onClearFilter && (
				<button
					type="button"
					className={RECOVERY_ACTION}
					onClick={onClearFilter}
				>
					Clear filter
				</button>
			)}
		</section>
	)
}
