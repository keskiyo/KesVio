import type {
	AppInfo,
	CatalogDelta,
	CatalogScanChanges,
} from '../../entities/app'

const LIMIT = 100

export function scanChanges(
	previous: Pick<AppInfo, 'id' | 'name'>[],
	delta: CatalogDelta,
): CatalogScanChanges {
	const byId = new Map(previous.map(app => [app.id, app.name]))
	const added: string[] = []
	const updated: string[] = []
	const removed: string[] = []
	let count = 0
	const add = (list: string[], name: string) => {
		count += 1
		if (count <= LIMIT) list.push(name.slice(0, 256))
	}
	for (const app of delta.upserted)
		add(byId.has(app.id) ? updated : added, app.name)
	for (const id of delta.removedIds) {
		const name = byId.get(id)
		if (name !== undefined) add(removed, name)
	}
	return { added, updated, removed, truncated: count > LIMIT }
}
