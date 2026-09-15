import { timestampFormatter } from '../../data'
import type { SourceHealthTableProps } from '../../types'

export function SourceHealthTable({ rows }: SourceHealthTableProps) {
	if (rows.length === 0) return null
	return (
		<div className="mt-4 overflow-x-auto">
			<table className="w-full min-w-104 text-left text-xs">
				<caption className="sr-only">Application source health</caption>
				<thead className="text-slate-600">
					<tr>
						<th scope="col" className="py-1 pr-3 font-medium">
							Source
						</th>
						<th scope="col" className="py-1 pr-3 font-medium">
							Status
						</th>
						<th scope="col" className="py-1 pr-3 font-medium">
							Apps
						</th>
						<th scope="col" className="py-1 pr-3 font-medium">
							Last success
						</th>
						<th scope="col" className="py-1 font-medium">
							Details
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map(row => (
						<tr
							key={row.key}
							className="border-t border-slate-200/70"
							data-attention={row.needsAttention || undefined}
						>
							<th scope="row" className="py-1.5 pr-3 font-normal">
								{row.label}
							</th>
							<td
								className={`py-1.5 pr-3 ${row.needsAttention ? 'font-medium text-amber-800' : ''}`}
							>
								{row.statusLabel}
							</td>
							<td className="py-1.5 pr-3 tabular-nums">
								{row.recordCount}
							</td>
							<td className="py-1.5 pr-3">
								{row.lastSuccessAt
									? timestampFormatter.format(
											new Date(row.lastSuccessAt * 1000),
										)
									: 'Never'}
							</td>
							<td className="py-1.5 text-slate-600">
								{row.reason ?? '—'}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
