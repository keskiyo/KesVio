import { Activity, ChevronDown, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import {
	describeSourceHealth,
	summarizeSourceHealth,
} from '../../../../entities/app'
import { CollapsiblePanel } from '../../../../shared/ui/CollapsiblePanel'
import {
	ACTION_BUTTON_PRIMARY,
	SETTINGS_SOURCE_ACTIONS,
	timestampFormatter,
} from '../../data'
import type { CatalogSourcesProps } from '../../types'
import { SettingsSectionHeader } from '../components/SettingsSectionHeader'
import { SourceHealthTable } from './SourceHealthTable'

export function CatalogSources({
	sources,
	lastScanAt,
	scanning,
	onRefresh,
}: CatalogSourcesProps) {
	const rows = sources.map(source => describeSourceHealth(source, scanning))
	const summary = summarizeSourceHealth(rows)
	const [expanded, setExpanded] = useState(summary.attention.length > 0)
	const contentId = 'catalog-sources'
	return (
		<section className="settings-surface mt-5 flex flex-col rounded-2xl border border-white/85 bg-white/58 p-5">
			<div className="flex items-center gap-4">
				<SettingsSectionHeader
					icon={Activity}
					title="Catalog sources"
					description={
						<span role="status">
							{summaryText(summary, scanning, lastScanAt)}
						</span>
					}
				/>
			</div>
			{(rows.length > 0 || onRefresh) && (
				<div className={SETTINGS_SOURCE_ACTIONS}>
					{rows.length > 0 && (
						<button
							type="button"
							aria-expanded={expanded}
							aria-controls={contentId}
							onClick={() => setExpanded(value => !value)}
							className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-(--border-neutral) bg-(--surface-inset) px-3 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--accent-strong)"
						>
							<span className="flex-1">Source details</span>
							<ChevronDown
								size={16}
								aria-hidden="true"
								className={`transition-transform duration-(--motion-fast) motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
							/>
						</button>
					)}
					{onRefresh && (
						<button
							type="button"
							disabled={scanning}
							onClick={() => void onRefresh()}
							className={ACTION_BUTTON_PRIMARY}
						>
							<RefreshCw size={16} aria-hidden="true" />
							{scanning ? 'Refreshing…' : 'Refresh catalog'}
						</button>
					)}
				</div>
			)}
			{rows.length > 0 && (
				<CollapsiblePanel open={expanded} id={contentId}>
					<SourceHealthTable rows={rows} />
				</CollapsiblePanel>
			)}
		</section>
	)
}

function summaryText(
	summary: ReturnType<typeof summarizeSourceHealth>,
	scanning: boolean,
	lastScanAt: number | null,
): string {
	if (summary.total === 0)
		return scanning
			? 'Scanning the configured sources…'
			: 'No source has been scanned yet.'
	if (scanning) return `Scanning ${summary.total} sources…`
	const lastScan = lastScanAt
		? ` · last scan ${timestampFormatter.format(new Date(lastScanAt * 1000))}`
		: ''
	if (summary.attention.length === 0)
		return `${summary.total} sources · all up to date${lastScan}`
	const listed = summary.attention
		.map(row => `${row.label} (${row.statusLabel})`)
		.join(', ')
	return `${summary.attention.length} of ${summary.total} sources need attention: ${listed}${lastScan}`
}
