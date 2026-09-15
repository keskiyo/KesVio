import type {
	Scenario,
	ScenarioImportClient,
	ScenarioImportChoice,
} from '../../../../entities/scenario'

export interface ScenarioImportDialogProps {
	client: ScenarioImportClient
	existing: Scenario[]
	disabled: boolean
	onClose(): void
}

export interface ScenarioImportRowsProps {
	incoming: Scenario[]
	existing: Scenario[]
	choices: ScenarioImportChoice[]
	disabled: boolean
	onSelect(id: string, checked: boolean): void
	onReplace(id: string, target: string | null): void
}
