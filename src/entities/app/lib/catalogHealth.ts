import type { CatalogDiagnostics } from '../model/app.types'
import {
	describeSourceHealth,
	type SourceHealthSummary,
	type SourceStatusRow,
	summarizeSourceHealth,
} from './sourceHealth'

export type CatalogHealthState =
	'no_diagnostics' | 'scanning' | 'attention' | 'healthy'

export interface CatalogHealthStatus {
	state: CatalogHealthState
	rows: SourceStatusRow[]
	summary: SourceHealthSummary
}

export function assessCatalogHealth(
	diagnostics: CatalogDiagnostics | null,
	scanning: boolean,
): CatalogHealthStatus {
	const rows = (diagnostics?.sources ?? []).map(source =>
		describeSourceHealth(source, scanning),
	)
	const summary = summarizeSourceHealth(rows)
	return { state: healthState(diagnostics, scanning, summary), rows, summary }
}

function healthState(
	diagnostics: CatalogDiagnostics | null,
	scanning: boolean,
	summary: SourceHealthSummary,
): CatalogHealthState {
	if (scanning) return 'scanning'
	if (!diagnostics) return 'no_diagnostics'
	return summary.attention.length > 0 ? 'attention' : 'healthy'
}
