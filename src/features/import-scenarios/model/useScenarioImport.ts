import { useEffect, useRef, useState } from 'react'
import {
	MAX_SCENARIO_BACKUP_BYTES,
	type Scenario,
	type ScenarioImportChoice,
	type ScenarioImportClient,
} from '../../../entities/scenario'

export function useScenarioImport(
	client: ScenarioImportClient,
	onClose: () => void,
) {
	const generation = useRef(0)
	const [reading, setReading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [draft, setDraft] = useState<{
		source: string
		scenarios: Scenario[]
	} | null>(null)
	const [choices, setChoices] = useState<ScenarioImportChoice[]>([])
	useEffect(
		() => () => {
			generation.current += 1
		},
		[],
	)
	async function read(file: File | undefined) {
		if (!file) return
		const current = ++generation.current
		setDraft(null)
		setChoices([])
		setError(null)
		if (file.size > MAX_SCENARIO_BACKUP_BYTES) {
			setError('The selected file is too large.')
			setReading(false)
			return
		}
		setReading(true)
		try {
			const source = await file.text()
			if (generation.current !== current) return
			const result = client.inspect(source)
			if (result.ok) setDraft({ source, scenarios: result.scenarios })
			else setError(result.error)
		} catch {
			if (generation.current === current)
				setError('The selected file could not be read.')
		} finally {
			if (generation.current === current) setReading(false)
		}
	}
	function select(sourceId: string, checked: boolean) {
		setChoices(current =>
			checked
				? [...current, { sourceId, replaceId: null }]
				: current.filter(choice => choice.sourceId !== sourceId),
		)
	}
	function replace(sourceId: string, replaceId: string | null) {
		setChoices(current =>
			current.map(choice =>
				choice.sourceId === sourceId ? { sourceId, replaceId } : choice,
			),
		)
	}
	function apply() {
		if (!draft || reading) return
		const result = client.apply(draft.source, choices)
		if (result.ok) onClose()
		else setError(result.error)
	}
	return { reading, error, draft, choices, read, select, replace, apply }
}
