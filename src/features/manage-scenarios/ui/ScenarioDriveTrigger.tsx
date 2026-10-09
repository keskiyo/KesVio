import { useId, useState } from 'react'
import type { DriveTriggerChoice, Scenario } from '../../../entities/scenario'

interface Props {
	scenario: Scenario
	drives: DriveTriggerChoice[]
	disabled: boolean
	onChange(id: string, volumeId: string | null): boolean
}

export function ScenarioDriveTrigger({
	scenario,
	drives,
	disabled,
	onChange,
}: Props) {
	const [failed, setFailed] = useState(false)
	const selectId = useId()
	const current = scenario.triggerVolumeId ?? ''
	const choices =
		current && !drives.some(drive => drive.volumeId === current)
			? [
					...drives,
					{ volumeId: current, label: 'A drive not connected now' },
				]
			: drives
	if (!choices.length) return null
	return (
		<div className="grid gap-1 text-xs text-(--text-muted)">
			<label htmlFor={selectId}>Offer to run when a drive connects</label>
			<select
				id={selectId}
				value={current}
				disabled={disabled}
				onChange={event =>
					setFailed(
						!onChange(scenario.id, event.target.value || null),
					)
				}
				className="h-9 max-w-full rounded-lg border border-(--border-neutral) bg-(--surface-inset) px-2 text-sm text-(--text-primary) focus-visible:outline-2 focus-visible:outline-(--accent-strong)"
			>
				<option value="">Never</option>
				{choices.map(drive => (
					<option key={drive.volumeId} value={drive.volumeId}>
						{drive.label}
					</option>
				))}
			</select>
			{failed && (
				<p role="alert">
					The drive trigger could not be saved. Try again.
				</p>
			)}
		</div>
	)
}
