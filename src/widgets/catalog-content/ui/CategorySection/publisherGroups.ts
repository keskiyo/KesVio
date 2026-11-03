import type { AppInfo } from '../../../../entities/app'

export type PublisherItem =
	| { kind: 'app'; app: AppInfo }
	| { kind: 'group'; key: string; publisher: string; apps: AppInfo[] }

export function publisherGroupLabel(
	publisher: string,
	apps: AppInfo[],
): string {
	const products = new Map<string, number>()
	for (const app of apps) {
		const product = app.productName?.trim().toLocaleLowerCase()
		if (product) products.set(product, (products.get(product) ?? 0) + 1)
	}
	const main = apps.find(app => {
		const name = app.name.trim().toLocaleLowerCase()
		return products.get(name) === apps.length
	})
	if (main) return main.name.trim()
	if (publisher.trim().toLocaleLowerCase() === 'blizzard entertainment') {
		const launcher = apps.find(
			app => app.name.trim().toLocaleLowerCase() === 'battle.net',
		)
		if (launcher) return launcher.name.trim()
	}
	return publisher
}

export function groupByPublisher(apps: AppInfo[]): PublisherItem[] {
	const groups = new Map<string, Extract<PublisherItem, { kind: 'group' }>>()
	for (const app of apps) {
		const publisher = app.publisher?.trim()
		if (!publisher) continue
		const key = publisher.toLocaleLowerCase()
		const group = groups.get(key)
		if (group) group.apps.push(app)
		else groups.set(key, { kind: 'group', key, publisher, apps: [app] })
	}
	const placed = new Set<string>()
	return apps.flatMap<PublisherItem>(app => {
		const key = app.publisher?.trim().toLocaleLowerCase()
		const group = key ? groups.get(key) : undefined
		if (!group || group.apps.length < 2)
			return [{ kind: 'app' as const, app }]
		if (placed.has(group.key)) return []
		placed.add(group.key)
		return [group]
	})
}
