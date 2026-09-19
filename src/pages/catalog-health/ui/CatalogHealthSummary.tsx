import {
	CircleCheck,
	CircleDashed,
	LoaderCircle,
	RefreshCw,
	TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
	CatalogDiagnostics,
	CatalogHealthState,
	CatalogHealthStatus,
} from '../../../entities/app'
import { countLabel } from '../../../shared/lib/countLabel'
import { ACTION_BUTTON_PRIMARY } from '../../../shared/ui/buttonVariants'
import { formatScanTime, HERO_SURFACE } from '../data'
import type { CatalogHealthSummaryProps, MetricTileProps } from '../types'
import { MetricTile } from './MetricTile'

const STATE_ICON: Record<CatalogHealthState, LucideIcon> = {
	healthy: CircleCheck,
	attention: TriangleAlert,
	scanning: LoaderCircle,
	no_diagnostics: CircleDashed,
}

const STATE_TITLE: Record<CatalogHealthState, string> = {
	healthy: 'Everything looks good',
	attention: 'Catalog needs attention',
	scanning: 'Refreshing catalog…',
	no_diagnostics: 'No scan data yet',
}

export function CatalogHealthSummary({
	diagnostics,
	health,
	refreshing,
	onRefresh,
}: CatalogHealthSummaryProps) {
	const Icon = STATE_ICON[health.state]
	const metrics = diagnostics ? buildMetrics(diagnostics, health) : []
	return (
		<section
			aria-labelledby="catalog-health-summary"
			className={HERO_SURFACE}
		>
			<div className="flex flex-wrap items-start gap-4">
				<Icon
					size={28}
					aria-hidden="true"
					className={`mt-0.5 shrink-0 ${health.state === 'scanning' ? 'animate-spin motion-reduce:animate-none' : ''}`}
				/>
				<div className="min-w-0 flex-1 basis-56">
					<h2
						id="catalog-health-summary"
						className="text-xl font-semibold tracking-tight text-(--text-primary)"
					>
						{STATE_TITLE[health.state]}
					</h2>
					<p
						role="status"
						className="mt-1 text-sm leading-6 text-(--text-muted)"
					>
						{leadText(health)}
					</p>
				</div>
				<button
					type="button"
					disabled={refreshing}
					onClick={() => void onRefresh()}
					className={`${ACTION_BUTTON_PRIMARY} w-full sm:w-auto`}
				>
					<RefreshCw size={16} aria-hidden="true" />
					{refreshing ? 'Refreshing…' : 'Refresh catalog'}
				</button>
			</div>
			{metrics.length > 0 && (
				<dl className="mt-5 grid gap-3 sm:grid-cols-3">
					{metrics.map(metric => (
						<MetricTile key={metric.label} {...metric} />
					))}
				</dl>
			)}
		</section>
	)
}

function leadText(health: CatalogHealthStatus): string {
	const { total, attention } = health.summary
	switch (health.state) {
		case 'no_diagnostics':
			return 'Refresh the catalog to check its sources.'
		case 'scanning':
			return total > 0
				? `Scanning ${countLabel(total, 'source')}…`
				: 'Scanning the configured sources…'
		case 'attention':
			return `${attention.length} of ${countLabel(total, 'source')} need attention.`
		case 'healthy':
			return total > 0
				? 'Every catalog source answered on the last scan.'
				: 'The last scan completed.'
	}
}

function buildMetrics(
	diagnostics: CatalogDiagnostics,
	health: CatalogHealthStatus,
): MetricTileProps[] {
	const { total, attention } = health.summary
	const sources: MetricTileProps =
		health.state === 'scanning'
			? { label: 'Sources', value: `${total} scanning…` }
			: attention.length > 0
				? {
						label: 'Sources',
						value: `${attention.length} of ${total} need attention`,
						attention: true,
					}
				: { label: 'Sources', value: `${total} up to date` }
	return [
		{ label: 'Applications', value: String(diagnostics.totalApps) },
		sources,
		{
			label: 'Last scan',
			value: formatScanTime(diagnostics.completedAt) ?? '—',
		},
	]
}
