import { WandSparkles } from 'lucide-react'
import { buildMoreDestinations, catalogHealthLine } from './data'
import { MoreCard } from './MoreCard'
import { MoreRecentList } from './MoreRecentList'
import type { MorePageProps } from './types'

export function MorePage({
	auxiliaryCount,
	hiddenCount,
	installersDocsCount,
	scenarioCount,
	catalogDiagnostics,
	isRefreshing,
	recentApps = [],
	preview,
	scenarioRun,
	onSelectView,
}: MorePageProps) {
	const destinations = buildMoreDestinations({
		auxiliaryCount,
		hiddenCount,
		installersDocsCount,
		scenarioCount,
		catalogHealthStatus: catalogHealthLine(
			catalogDiagnostics,
			isRefreshing,
		),
		preview,
		scenarioPreview: {
			runningId: scenarioRun.runningId,
			isScenarioRunning: scenarioRun.isScenarioRunning,
			onRun: scenarioRun.onRun,
			onViewAll: scenarioRun.onViewAll,
		},
	})
	const primary = destinations.filter(
		destination =>
			!['catalog_health', 'backup_restore'].includes(destination.view),
	)
	const maintenance = destinations.filter(destination =>
		['catalog_health', 'backup_restore'].includes(destination.view),
	)

	return (
		<section aria-labelledby="more-title" className="mx-auto max-w-5xl">
			<header className="mb-8 flex items-start gap-3">
				<WandSparkles
					aria-hidden="true"
					className="mt-0.5 shrink-0"
					size={28}
				/>
				<div>
					<h1 id="more-title" className="text-2xl font-semibold">
						More
					</h1>
					<p className="mt-1 text-sm text-(--text-muted)">
						Catalog views and tools.
					</p>
				</div>
			</header>
			<div className="grid gap-3 lg:grid-cols-2">
				{primary.map(destination => (
					<MoreCard
						key={destination.view}
						destination={destination}
						onSelect={onSelectView}
					/>
				))}
			</div>
			{recentApps.length > 0 && <MoreRecentList entries={recentApps} />}
			<section aria-labelledby="more-maintenance-title" className="mt-8">
				<h2
					id="more-maintenance-title"
					className="mb-3 text-base font-semibold"
				>
					Maintenance
				</h2>
				<div className="grid gap-3 lg:grid-cols-2">
					{maintenance.map(destination => (
						<MoreCard
							key={destination.view}
							destination={destination}
							onSelect={onSelectView}
						/>
					))}
				</div>
			</section>
		</section>
	)
}
