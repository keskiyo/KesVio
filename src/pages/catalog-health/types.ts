import type {
	CatalogDiagnostics,
	CatalogHealthStatus,
	SourceStatusRow,
	TargetAvailabilityDiff,
} from '../../entities/app'

export interface CatalogHealthPageProps {
	diagnostics: CatalogDiagnostics | null
	isRefreshing: boolean
	onRefresh(): Promise<void>
	onPreviewDiagnostics(): Promise<string>
	onExportDiagnostics(): Promise<boolean>
	onBack(): void
}

export interface CatalogHealthSummaryProps {
	diagnostics: CatalogDiagnostics | null
	health: CatalogHealthStatus
	refreshing: boolean
	onRefresh(): Promise<void>
}

export interface MetricTileProps {
	label: string
	value: string
	attention?: boolean
}

export interface CatalogSourcesProps {
	health: CatalogHealthStatus
	scanning: boolean
}

export interface SourceStatusListProps {
	rows: SourceStatusRow[]
}

export interface SourceHealthTableProps {
	rows: SourceStatusRow[]
}

export interface LastScanPanelProps {
	diagnostics: CatalogDiagnostics | null
}

export interface TargetAvailabilityPanelProps {
	diff?: TargetAvailabilityDiff
}

export interface DiagnosticsLogProps {
	onPreview(): Promise<string>
	onExport(): Promise<boolean>
}
