import { HeartPulse } from 'lucide-react'
import { assessCatalogHealth } from '../../../entities/app'
import { CatalogViewHeader } from '../../../widgets/catalog-content'
import type { CatalogHealthPageProps } from '../types'
import { CatalogHealthSummary } from './CatalogHealthSummary'
import { CatalogSources } from './CatalogSources'
import { DiagnosticsLog } from './DiagnosticsLog/DiagnosticsLog'
import { LastScanPanel } from './LastScanPanel'

export function CatalogHealthPage({
	diagnostics,
	isRefreshing,
	onRefresh,
	onPreviewDiagnostics,
	onExportDiagnostics,
	onBack,
}: CatalogHealthPageProps) {
	const health = assessCatalogHealth(diagnostics, isRefreshing)
	return (
		<section
			aria-labelledby="catalog-health-title"
			className="mx-auto w-full max-w-5xl"
		>
			<CatalogViewHeader
				icon={HeartPulse}
				title="Catalog Health"
				titleId="catalog-health-title"
				description="Whether every source answered, what the last scan found and how long it took."
				back={{ label: 'Back to More', onBack }}
			/>
			<CatalogHealthSummary
				diagnostics={diagnostics}
				health={health}
				refreshing={isRefreshing}
				onRefresh={onRefresh}
			/>
			<div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
				<CatalogSources health={health} scanning={isRefreshing} />
				<LastScanPanel diagnostics={diagnostics} />
			</div>
			<p className="mt-8 mb-2 text-xs font-semibold tracking-[0.14em] text-(--text-muted) uppercase">
				Advanced
			</p>
			<DiagnosticsLog
				onPreview={onPreviewDiagnostics}
				onExport={onExportDiagnostics}
			/>
		</section>
	)
}
