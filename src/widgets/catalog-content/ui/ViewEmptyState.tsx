import { ACTION_BUTTON_QUIET } from '../../../shared/ui/buttonVariants'
import type { ViewEmptyStateProps } from '../types'

export function ViewEmptyState({
	icon: Icon,
	title,
	description,
	back,
}: ViewEmptyStateProps) {
	return (
		<div className="mx-auto grid max-w-sm place-items-center py-16 text-center">
			<span className="grid size-14 place-items-center rounded-2xl border border-(--border-neutral) bg-(--surface-raised)">
				<Icon size={26} aria-hidden="true" />
			</span>
			<h2 className="mt-4 text-lg font-semibold text-(--text-primary)">
				{title}
			</h2>
			<p className="mt-1.5 text-sm leading-6 text-(--text-muted)">
				{description}
			</p>
			{back && (
				<button
					type="button"
					onClick={back.onBack}
					className={`${ACTION_BUTTON_QUIET} mt-5`}
				>
					{back.label}
				</button>
			)}
		</div>
	)
}
