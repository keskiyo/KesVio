import type { ScenarioImportRowsProps } from './types'

export function ScenarioImportRows({
	incoming,
	existing,
	choices,
	disabled,
	onSelect,
	onReplace,
}: ScenarioImportRowsProps) {
	return (
		<div className="grid gap-3">
			{incoming.map(item => {
				const choice = choices.find(entry => entry.sourceId === item.id)
				return (
					<div
						key={item.id}
						className="grid gap-2 rounded-xl border border-(--border-neutral) p-3"
					>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={Boolean(choice)}
								disabled={disabled}
								onChange={event =>
									onSelect(item.id, event.target.checked)
								}
							/>
							<span className="min-w-0 break-words">
								{item.name}
							</span>
						</label>
						<p className="text-xs text-(--text-muted)">
							{item.launchIdentities.length} to launch ·{' '}
							{item.closeIdentities.length} to close ·{' '}
							{(item.forceClose ?? true)
								? 'Force close enabled'
								: 'Graceful close'}
						</p>
						{choice && (
							<label className="grid gap-1 text-xs">
								Import action for {item.name}
								<select
									className="min-w-0 rounded-lg border border-(--border-neutral) bg-(--surface-inset) p-2 text-(--text-primary)"
									value={choice.replaceId ?? ''}
									disabled={disabled}
									onChange={event =>
										onReplace(
											item.id,
											event.target.value || null,
										)
									}
								>
									<option value="">Create copy</option>
									{existing.map(target => (
										<option
											key={target.id}
											value={target.id}
											disabled={choices.some(
												entry =>
													entry.sourceId !==
														item.id &&
													entry.replaceId ===
														target.id,
											)}
										>
											Replace {target.name}
										</option>
									))}
								</select>
							</label>
						)}
					</div>
				)
			})}
		</div>
	)
}
