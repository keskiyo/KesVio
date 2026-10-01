import { type AppInfo, appIdentity } from '../../entities/app'
import { type IdentityRekeys, rekeyRecord } from './identityRekey'

export interface FirstSeen {
	firstSeenAt: Record<string, number>
	firstSeenVolumes: Record<string, string>
}

export function rekeyFirstSeen(
	current: FirstSeen,
	rekeys: IdentityRekeys,
): FirstSeen {
	const firstSeenAt = rekeyRecord(current.firstSeenAt, rekeys)
	const firstSeenVolumes = rekeyRecord(current.firstSeenVolumes, rekeys)
	return firstSeenAt === current.firstSeenAt &&
		firstSeenVolumes === current.firstSeenVolumes
		? current
		: { firstSeenAt, firstSeenVolumes }
}

export function reconcileFirstSeen(
	apps: AppInfo[],
	previous: FirstSeen,
	now: number,
): FirstSeen {
	let firstSeenAt = previous.firstSeenAt
	let firstSeenVolumes = previous.firstSeenVolumes
	for (const app of apps) {
		const identity = appIdentity(app)
		if (!(identity in firstSeenAt)) {
			if (firstSeenAt === previous.firstSeenAt)
				firstSeenAt = { ...firstSeenAt }
			firstSeenAt[identity] = now
		}
		const volume = app.volumeId?.trim() || null
		const recorded = firstSeenVolumes[identity] ?? null
		if (volume === recorded) continue
		if (firstSeenVolumes === previous.firstSeenVolumes)
			firstSeenVolumes = { ...firstSeenVolumes }
		if (volume) firstSeenVolumes[identity] = volume
		else delete firstSeenVolumes[identity]
	}
	return firstSeenAt === previous.firstSeenAt &&
		firstSeenVolumes === previous.firstSeenVolumes
		? previous
		: { firstSeenAt, firstSeenVolumes }
}

export function pruneFirstSeen(apps: AppInfo[], current: FirstSeen): FirstSeen {
	const present = new Set(apps.map(appIdentity))
	const mounted = new Set(
		apps.flatMap(app => (app.volumeId ? [app.volumeId.trim()] : [])),
	)
	const keeps = (identity: string) => {
		if (present.has(identity)) return true
		const volume = current.firstSeenVolumes[identity]
		return volume !== undefined && !mounted.has(volume)
	}
	const identities = Object.keys(current.firstSeenAt)
	if (identities.every(keeps)) return current
	const firstSeenAt: Record<string, number> = {}
	const firstSeenVolumes: Record<string, string> = {}
	for (const identity of identities) {
		if (!keeps(identity)) continue
		firstSeenAt[identity] = current.firstSeenAt[identity]
		const volume = current.firstSeenVolumes[identity]
		if (volume !== undefined) firstSeenVolumes[identity] = volume
	}
	return { firstSeenAt, firstSeenVolumes }
}
