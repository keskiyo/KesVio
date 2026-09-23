import { UpdatePill } from '../../../features/update-app'
import type { NavigationIdentityProps } from '../types'

export function NavigationIdentity({
	onGoHome,
	version,
	update,
}: NavigationIdentityProps) {
	return (
		<div className="relative min-w-0 flex-1">
			<button
				type="button"
				aria-label="Go to All Apps"
				onClick={onGoHome}
				className="flex w-full min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
			>
				<img
					src="/app-icon.png"
					alt=""
					className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-violet-400/25 ring-inset"
				/>
				<span className="flex min-w-0 flex-col gap-1">
					<span className="truncate text-[1.05rem] leading-tight font-semibold tracking-tight text-(--text-primary)">
						KesVio
					</span>
					<span className="h-5 truncate text-xs leading-5 text-(--text-subtle)">
						{!update && version ? `Version ${version}` : null}
					</span>
				</span>
			</button>
			{update && (
				<UpdatePill
					{...update}
					className="absolute bottom-0 left-13 max-w-[calc(100%-3.25rem)]"
				/>
			)}
		</div>
	)
}
