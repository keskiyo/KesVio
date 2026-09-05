import { PLATFORM_LABELS } from '../../lib/appPlatform'
import { PlatformIcon } from './PlatformIcon'
import type { PlatformBadgeProps } from './types'

export function PlatformBadge({ platformKind }: PlatformBadgeProps) {
	if (!platformKind) return null

	const label = PLATFORM_LABELS[platformKind]

	return (
		<span
			title={label}
			aria-hidden="true"
			data-platform={platformKind}
			className="app-card-platform-badge icon-follows-color pointer-events-none absolute z-2 grid place-items-center rounded-full border border-white/55 bg-slate-950/75 text-white shadow-sm"
		>
			<PlatformIcon platformKind={platformKind} />
		</span>
	)
}
