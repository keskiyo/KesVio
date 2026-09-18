import type { AppInfo, CatalogDiagnostics } from '../../entities/app'

export type CatalogGenerationOrder = 'stale' | 'same' | 'newer'

export function catalogGenerationOrder(
	incoming: number | null | undefined,
	current: number,
): CatalogGenerationOrder {
	const generation = incoming ?? 0
	if (generation < current) return 'stale'
	return generation === current ? 'same' : 'newer'
}

export function newerDiagnostics(
	current: CatalogDiagnostics | null,
	incoming: CatalogDiagnostics | null | undefined,
): CatalogDiagnostics | null {
	if (!incoming) return current
	if (current && incoming.completedAt < current.completedAt) return current
	return incoming
}

export function mergeIcon(
	previous: AppInfo | undefined,
	next: AppInfo,
): AppInfo {
	return previous?.iconBase64 && !next.iconBase64
		? { ...next, iconBase64: previous.iconBase64 }
		: next
}

export function keepHeldRecords(
	held: AppInfo[],
	incoming: AppInfo[],
	order: CatalogGenerationOrder,
): AppInfo[] {
	const previous = new Map(held.map(app => [app.id, app]))
	return incoming.map(app =>
		order === 'same'
			? (previous.get(app.id) ?? app)
			: mergeIcon(previous.get(app.id), app),
	)
}
