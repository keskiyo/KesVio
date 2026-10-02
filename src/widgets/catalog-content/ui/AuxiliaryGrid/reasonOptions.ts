import { type AppInfo, auxiliaryReason } from '../../../../entities/app'
import type { ReasonOption } from './types'

export function reasonOptions(apps: readonly AppInfo[]): ReasonOption[] {
	const counts = new Map<ReasonOption['reason'], number>()
	for (const app of apps) {
		const reason = auxiliaryReason(app)
		if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1)
	}
	return [...counts]
		.map(([reason, count]) => ({ reason, count }))
		.sort((a, b) => b.count - a.count)
}
