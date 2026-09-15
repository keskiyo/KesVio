import { type AppInfo, appIdentity } from '../../entities/app'

export type IdentityRekeys = Map<string, string>

export function identityRekeys(
	previous: AppInfo[],
	next: AppInfo[],
): IdentityRekeys {
	const rekeys: IdentityRekeys = new Map()
	if (previous.length === 0) return rekeys
	const before = new Map(previous.map(app => [app.id, appIdentity(app)]))
	for (const app of next) {
		const earlier = before.get(app.id)
		const current = appIdentity(app)
		if (earlier !== undefined && earlier !== current)
			rekeys.set(earlier, current)
	}
	return rekeys
}

export function rekeyRecord<T>(
	record: Record<string, T>,
	rekeys: IdentityRekeys,
): Record<string, T> {
	if (rekeys.size === 0) return record
	let changed = false
	const next = { ...record }
	for (const [earlier, current] of rekeys) {
		if (!(earlier in next) || current in next) continue
		next[current] = next[earlier]
		delete next[earlier]
		changed = true
	}
	return changed ? next : record
}
