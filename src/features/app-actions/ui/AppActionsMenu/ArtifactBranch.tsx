import { useSpotlight } from '../../../../shared/hooks/useSpotlight'
import { SpotlightLayer } from '../../../../shared/ui/SpotlightLayer'
import { ARTIFACT_DESTINATIONS } from './data'
import type { ArtifactBranchProps } from './types'

export function ArtifactBranch({ label, onSelect }: ArtifactBranchProps) {
	const spotlight = useSpotlight()

	return (
		<div
			role="group"
			aria-label={label}
			className="ml-3 flex flex-col gap-0.5 border-l border-slate-300/60 pl-1.5"
		>
			{ARTIFACT_DESTINATIONS.map(destination => (
				<button
					key={destination.kind}
					type="button"
					role="menuitem"
					onClick={() => onSelect(destination.kind)}
					{...spotlight}
					className="relative flex w-full items-center rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-500/15 focus-visible:outline-2 focus-visible:outline-violet-500"
				>
					<SpotlightLayer size={60} />
					{destination.label}
				</button>
			))}
		</div>
	)
}
