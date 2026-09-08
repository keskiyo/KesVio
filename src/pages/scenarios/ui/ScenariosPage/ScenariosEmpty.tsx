interface ScenariosEmptyProps {
	filtered: boolean
	onReset(): void
}

export function ScenariosEmpty({ filtered, onReset }: ScenariosEmptyProps) {
	return (
		<div className="grid min-h-[40vh] place-items-center text-center">
			<div className="max-w-sm">
				<h2 className="text-lg font-semibold">
					{filtered ? 'Nothing matches' : 'No scenarios yet'}
				</h2>
				<p className="mt-2 text-sm text-(--text-muted)">
					{filtered
						? 'No scenario matches this search and filter.'
						: 'A scenario starts the apps in its launch list and closes the ones in its close list, in one click.'}
				</p>
				{filtered && (
					<button
						type="button"
						onClick={onReset}
						className="mt-4 inline-flex h-8 items-center rounded-lg border border-(--border-neutral) bg-(--surface-panel) px-3 text-xs font-medium text-(--text-primary) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
					>
						Clear search and filters
					</button>
				)}
			</div>
		</div>
	)
}
