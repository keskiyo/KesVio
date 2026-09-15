import { useState } from 'react'
import type { Scenario } from '../../../entities/scenario'

interface Props {
	scenario: Scenario
	disabled: boolean
	onChange(id: string, forceClose: boolean): boolean
}

export function ScenarioClosePolicy({ scenario, disabled, onChange }: Props) {
	const [failed, setFailed] = useState(false)
	return (
		<div className="grid gap-1 text-xs text-(--text-muted)">
			<label className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={scenario.forceClose ?? true}
					disabled={disabled}
					onChange={event =>
						setFailed(!onChange(scenario.id, event.target.checked))
					}
				/>
				Force close after 5 seconds
			</label>
			<p>
				{(scenario.forceClose ?? true)
					? 'Apps that stay open will be forcibly closed. Unsaved work may be lost.'
					: 'Ask apps to close. Apps that refuse or need more time stay open.'}
			</p>
			{failed && (
				<p role="alert">
					The close policy could not be saved. Try again.
				</p>
			)}
		</div>
	)
}
