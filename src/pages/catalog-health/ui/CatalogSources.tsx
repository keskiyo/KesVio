import { Activity, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { SourceHealthSummary } from '../../../entities/app'
import { CollapsiblePanel } from '../../../shared/ui/CollapsiblePanel'
import { PanelHeader } from '../../../shared/ui/PanelHeader'
import { DISCLOSURE_BUTTON, SECTION_SURFACE } from '../data'
import type { CatalogSourcesProps } from '../types'
import { SourceHealthTable } from './SourceHealthTable'
import { SourceStatusList } from './SourceStatusList'

export function CatalogSources({ health, scanning }: CatalogSourcesProps) {
	const { rows, summary } = health
	const [expanded, setExpanded] = useState(summary.attention.length > 0)
	const contentId = 'catalog-sources'
	return (
		<section aria-label="Catalog sources" className={SECTION_SURFACE}>
			<PanelHeader
				icon={Activity}
				title="Catalog sources"
				description={
					<span role="status">{summaryText(summary, scanning)}</span>
				}
			/>
			{rows.length > 0 && (
				<>
					<div className="mt-4">
						<SourceStatusList rows={rows} />
					</div>
					<button
						type="button"
						aria-expanded={expanded}
						aria-controls={contentId}
						onClick={() => setExpanded(value => !value)}
						className={`mt-3 ${DISCLOSURE_BUTTON}`}
					>
						<span className="flex-1">Source details</span>
						<ChevronDown
							size={16}
							aria-hidden="true"
							className={`transition-transform duration-(--motion-fast) motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
						/>
					</button>
					<CollapsiblePanel open={expanded} id={contentId}>
						<SourceHealthTable rows={rows} />
					</CollapsiblePanel>
				</>
			)}
		</section>
	)
}

function summaryText(summary: SourceHealthSummary, scanning: boolean): string {
	if (summary.total === 0)
		return scanning
			? 'Scanning the configured sources…'
			: 'No source has been scanned yet.'
	if (scanning) return `Scanning ${summary.total} sources…`
	if (summary.attention.length === 0)
		return `${summary.total} sources · all up to date`
	return `${summary.attention.length} of ${summary.total} sources need attention`
}
