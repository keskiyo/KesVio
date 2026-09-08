interface ScenarioLauncherEmptyProps {
	filtered: boolean
	onReset(): void
}

export function ScenarioLauncherEmpty({
	filtered,
	onReset,
}: ScenarioLauncherEmptyProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
			<p className="text-sm text-(--text-muted)">
				{filtered
					? 'No scenario matches this search.'
					: 'No scenarios yet.'}
			</p>
			{filtered && (
				<button
					type="button"
					onClick={onReset}
					className="inline-flex h-8 items-center rounded-lg border border-(--border-neutral) bg-(--surface-panel) px-3 text-xs font-medium text-(--text-primary) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
				>
					Clear search and filters
				</button>
			)}
		</div>
	)
}
