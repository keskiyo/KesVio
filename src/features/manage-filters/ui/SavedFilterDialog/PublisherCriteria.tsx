import { Search, X } from 'lucide-react'
import { useState } from 'react'
import type { SavedFilterCriteria } from '../../../../entities/app'
import { FilterChoice } from './FilterChoice'
import { FilterDisclosure } from './FilterDisclosure'

interface PublisherCriteriaProps {
	publishers: string[]
	criteria: SavedFilterCriteria
	onChange(criteria: SavedFilterCriteria): void
}

export function PublisherCriteria({
	publishers,
	criteria,
	onChange,
}: PublisherCriteriaProps) {
	const [query, setQuery] = useState('')
	const knownNames = new Set(
		publishers.map(publisher => publisher.toLocaleLowerCase()),
	)
	const knownPublishers = [
		...publishers,
		...criteria.publishers.filter(
			publisher => !knownNames.has(publisher.toLocaleLowerCase()),
		),
	]
	const normalizedQuery = query.trim().toLocaleLowerCase()
	const visiblePublishers = knownPublishers.filter(publisher =>
		publisher.toLocaleLowerCase().includes(normalizedQuery),
	)

	return (
		<FilterDisclosure
			title="Publisher"
			selectedCount={criteria.publishers.length}
		>
			<div className="flex items-center gap-2">
				<label className="relative min-w-0 flex-1">
					<span className="sr-only">Search publishers</span>
					<Search
						size={15}
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--text-muted)"
					/>
					<input
						type="text"
						role="searchbox"
						value={query}
						onChange={event => setQuery(event.target.value)}
						placeholder="Search publishers…"
						className="search-input h-10 w-full rounded-lg border border-(--border-neutral) bg-(--surface-panel) pr-3 pl-9 text-xs text-(--text-primary) outline-none"
					/>
				</label>
				{query && (
					<button
						type="button"
						aria-label="Clear publisher search"
						onClick={() => setQuery('')}
						className="grid size-9 shrink-0 place-items-center rounded-lg text-(--text-muted) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-(--accent-strong)"
					>
						<X size={15} aria-hidden="true" />
					</button>
				)}
			</div>
			<div className="mt-2 grid h-52 min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border border-(--border-neutral) bg-(--surface-panel) p-2">
				{visiblePublishers.length === 0 ? (
					<p className="px-1.5 py-2 text-sm text-(--text-muted)">
						{knownPublishers.length === 0
							? 'No publisher is known yet.'
							: 'No publishers match.'}
					</p>
				) : (
					visiblePublishers.map(publisher => {
						const normalizedPublisher =
							publisher.toLocaleLowerCase()
						return (
							<FilterChoice
								key={publisher}
								type="checkbox"
								truncate
								checked={criteria.publishers.some(
									entry =>
										entry.toLocaleLowerCase() ===
										normalizedPublisher,
								)}
								onChange={event =>
									onChange({
										...criteria,
										publishers: event.target.checked
											? [
													...criteria.publishers,
													publisher,
												]
											: criteria.publishers.filter(
													entry =>
														entry.toLocaleLowerCase() !==
														normalizedPublisher,
												),
									})
								}
							>
								{publisher}
							</FilterChoice>
						)
					})
				)}
			</div>
			<div className="mt-1 flex min-h-8 items-center justify-end">
				{criteria.publishers.length > 0 && (
					<button
						type="button"
						onClick={() =>
							onChange({ ...criteria, publishers: [] })
						}
						className="rounded-lg px-2 py-1 text-xs font-medium text-(--accent-strong) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-(--accent-strong)"
					>
						Clear publishers
					</button>
				)}
			</div>
		</FilterDisclosure>
	)
}
