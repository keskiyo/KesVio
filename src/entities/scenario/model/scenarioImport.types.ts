import type { Scenario } from './scenario.types'

export const MAX_SCENARIO_BACKUP_BYTES = 1_048_576

export interface ScenarioImportChoice {
	sourceId: string
	replaceId: string | null
}

export type ScenarioImportPreview =
	{ ok: true; scenarios: Scenario[] } | { ok: false; error: string }

export interface ScenarioImportClient {
	inspect(source: string): ScenarioImportPreview
	apply(
		source: string,
		choices: ScenarioImportChoice[],
	): { ok: true } | { ok: false; error: string }
}
