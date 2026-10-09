import { EyeOff, RotateCcw, Wrench } from 'lucide-react'
import { MenuItem } from './MenuItem'
import type { PlacementItemProps } from './types'

export function PlacementItem({
	app,
	isHidden,
	isUserPromoted,
	onHide,
	onRestore,
	onDemote,
	onClose,
}: PlacementItemProps) {
	if (isHidden && !onRestore) return null
	return (
		<MenuItem
			icon={isHidden ? RotateCcw : isUserPromoted ? Wrench : EyeOff}
			label={
				isHidden ? (
					'Restore to catalog'
				) : isUserPromoted ? (
					<>
						<span aria-hidden="true">Move back</span>
						<span
							aria-hidden="true"
							data-destination-tooltip
							className="pointer-events-none absolute right-1 bottom-[calc(100%+0.25rem)] z-20 translate-y-1 rounded-md border border-(--border-neutral) bg-(--surface-inset) px-2 py-1 text-xs font-normal whitespace-nowrap text-(--text-primary) opacity-0 shadow-(--shadow-menu) transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
						>
							Moves to Auxiliary tools
						</span>
						<span className="sr-only">
							Move back to Auxiliary tools
						</span>
					</>
				) : (
					'Hide from catalog'
				)
			}
			onClick={() => {
				if (isHidden) onRestore?.(app.id)
				else if (isUserPromoted) onDemote(app.id)
				else onHide(app.id)
				onClose()
			}}
		/>
	)
}
