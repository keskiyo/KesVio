import type { CatalogScanChanges } from '../../../entities/app'
import { SECTION_SURFACE } from '../data'

export function ScanChanges({
	changes,
	availableIds,
	onOpen,
}: {
	changes?: CatalogScanChanges | null
	availableIds?: string[]
	onOpen?(id: string): void
}) {
	const available = new Set(availableIds ?? [])
	const groups =
		changes &&
		([
			['Added', changes.added],
			['Updated', changes.updated],
			['Removed', changes.removed],
		] as const)
	return (
		<section
			aria-label="Scan changes"
			className={`${SECTION_SURFACE} mt-4 min-w-0`}
		>
			<h2 className="text-lg font-semibold">Scan changes</h2>
			<div aria-live="polite" className="mt-3 text-sm">
				{!groups ? (
					<p>
						Changes are unavailable for this scan. Refresh the
						catalog to see them.
					</p>
				) : groups.every(([, names]) => names.length === 0) ? (
					<p>No catalog changes in this scan.</p>
				) : (
					groups.map(
						([label, names]) =>
							names.length > 0 && (
								<div key={label} className="mt-3 min-w-0">
									<h3 className="font-semibold">{label}</h3>
									<ul className="mt-1 list-inside list-disc break-words">
										{names.map((name, index) => {
											const id =
												label === 'Added'
													? changes?.addedIds?.[index]
													: label === 'Updated'
														? changes?.updatedIds?.[
																index
															]
														: undefined
											return (
												<li key={`${index}-${name}`}>
													{id &&
													available.has(id) &&
													onOpen ? (
														<button
															type="button"
															aria-label={`Open information for ${name}`}
															className="rounded text-(--accent-strong) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-(--accent)"
															onClick={() =>
																onOpen(id)
															}
														>
															{name}
														</button>
													) : (
														name
													)}
												</li>
											)
										})}
									</ul>
								</div>
							),
					)
				)}
				{changes?.truncated && (
					<p className="mt-3">
						Only the first 100 changes are shown.
					</p>
				)}
			</div>
		</section>
	)
}
