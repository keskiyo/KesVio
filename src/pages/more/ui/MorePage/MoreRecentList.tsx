import { groupRecentEntries } from './groupRecentEntries'
import { MorePreviewRow } from './MorePreviewRow'
import type { MorePreviewItem } from './types'

interface Props {
	entries: MorePreviewItem[]
}

export function MoreRecentList({ entries }: Props) {
	return (
		<section className="mt-6 overflow-hidden rounded-2xl border border-(--border-neutral) bg-(--surface-panel)">
			<header className="px-5 pt-4 pb-2">
				<h2 className="text-base font-semibold">Recently added</h2>
				<p className="mt-1 text-xs leading-5 text-(--text-muted)">
					First seen in your catalog, not the installation date.
				</p>
			</header>
			{groupRecentEntries(entries).map(group => (
				<div key={group.runs[0].items[0].app.id} className="pb-3">
					<h3 className="px-5 pt-3 pb-1 text-sm font-medium text-(--text-muted)">
						{group.label}
					</h3>
					{group.runs.map(run => {
						const grouped =
							run.publisher !== null && run.items.length > 1
						return (
							<div
								key={run.items[0].app.id}
								role={grouped ? 'group' : undefined}
								aria-label={
									grouped ? run.publisher! : undefined
								}
							>
								{grouped && (
									<p className="px-5 pt-2 pb-1 text-xs font-medium text-(--text-muted)">
										{run.publisher}
									</p>
								)}
								<ul aria-label={group.label}>
									{run.items.map(entry => (
										<MorePreviewRow
											key={entry.app.id}
											entry={entry}
											context={
												grouped
													? 'publisher-group'
													: 'timeline'
											}
										/>
									))}
								</ul>
							</div>
						)
					})}
				</div>
			))}
		</section>
	)
}
