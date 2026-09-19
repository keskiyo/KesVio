import { ChevronDown, Wrench } from 'lucide-react'
import { useState } from 'react'
import type { CatalogDiagnostics } from '../../../entities/app'
import { CollapsiblePanel } from '../../../shared/ui/CollapsiblePanel'
import { PanelHeader } from '../../../shared/ui/PanelHeader'
import {
	DISCLOSURE_BUTTON,
	formatDuration,
	formatScanTime,
	SECTION_SURFACE,
} from '../data'
import type { LastScanPanelProps, MetricTileProps } from '../types'
import { MetricTile } from './MetricTile'
import { TargetAvailabilityPanel } from './TargetAvailabilityPanel'

export function LastScanPanel({ diagnostics }: LastScanPanelProps) {
	const [expanded, setExpanded] = useState(false)
	const contentId = 'last-scan-details'
	const completedAt = diagnostics
		? formatScanTime(diagnostics.completedAt)
		: null
	return (
		<section
			aria-label="Last scan"
			className={`${SECTION_SURFACE} min-w-0`}
		>
			<PanelHeader
				icon={Wrench}
				title="Last scan"
				description={
					diagnostics
						? completedAt
							? `Completed ${completedAt}`
							: `Mode: ${diagnostics.mode}`
						: 'No scan diagnostics yet.'
				}
			/>
			{diagnostics ? (
				<>
					<dl className="mt-4 grid grid-cols-2 gap-3">
						{metrics(diagnostics).map(metric => (
							<MetricTile key={metric.label} {...metric} />
						))}
					</dl>
					<button
						type="button"
						aria-expanded={expanded}
						aria-controls={contentId}
						onClick={() => setExpanded(value => !value)}
						className={`mt-3 ${DISCLOSURE_BUTTON}`}
					>
						<span className="flex-1">Technical details</span>
						<ChevronDown
							size={16}
							aria-hidden="true"
							className={`transition-transform duration-(--motion-fast) motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
						/>
					</button>
					<CollapsiblePanel open={expanded} id={contentId}>
						<TechnicalDetails diagnostics={diagnostics} />
					</CollapsiblePanel>
				</>
			) : (
				<p className="mt-3 text-sm leading-6 text-(--text-muted)">
					Refresh the catalog to record what a scan finds and how long
					it takes.
				</p>
			)}
		</section>
	)
}

function metrics(diagnostics: CatalogDiagnostics): MetricTileProps[] {
	return [
		{ label: 'Added', value: String(diagnostics.added) },
		{ label: 'Updated', value: String(diagnostics.updated) },
		{ label: 'Removed', value: String(diagnostics.removed) },
		{
			label: 'Duration',
			value: formatDuration(diagnostics.durationMs),
		},
	]
}

function TechnicalDetails({
	diagnostics,
}: {
	diagnostics: CatalogDiagnostics
}) {
	return (
		<div className="mt-3 rounded-xl border border-(--border-neutral) bg-(--surface-inset) px-4 py-3 text-xs leading-5 text-slate-600">
			<p>Mode: {diagnostics.mode}</p>
			<p>{countList(diagnostics.sourceCounts)}</p>
			{diagnostics.visibilityCounts && (
				<p>{countList(diagnostics.visibilityCounts)}</p>
			)}
			{diagnostics.unreachableFolders !== undefined && (
				<p>Unreachable folders: {diagnostics.unreachableFolders}</p>
			)}
			<TargetAvailabilityPanel diff={diagnostics.targetAvailability} />
		</div>
	)
}

function countList(counts: Record<string, number>): string {
	return Object.entries(counts)
		.map(([key, count]) => `${key}: ${count}`)
		.join(' · ')
}
