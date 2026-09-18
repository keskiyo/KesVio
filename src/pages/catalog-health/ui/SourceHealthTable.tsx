import { formatDateTime } from '../../../shared/lib/dates'
import { ATTENTION_TEXT } from '../data'
import type { SourceHealthTableProps } from '../types'

export function SourceHealthTable({ rows }: SourceHealthTableProps) {
	if (rows.length === 0) return null
	return (
		<div className="mt-4 min-w-0">
			<ul
				aria-label="Application source health for narrow windows"
				className="grid gap-2 sm:hidden"
			>
				{rows.map(row => (
					<li
						key={row.key}
						className="min-w-0 rounded-xl border border-(--border-neutral) bg-(--surface-inset)/55 p-3"
						data-attention={row.needsAttention || undefined}
					>
						<div className="flex min-w-0 items-start justify-between gap-3">
							<span className="min-w-0 text-sm font-medium break-words">
								{row.label}
							</span>
							<span
								className={`shrink-0 text-xs font-medium ${row.needsAttention ? ATTENTION_TEXT : 'text-slate-600'}`}
							>
								{row.statusLabel}
							</span>
						</div>
						<dl className="mt-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
							<dt className="text-slate-500">Apps</dt>
							<dd className="min-w-0 text-right tabular-nums">
								{row.recordCount}
							</dd>
							<dt className="text-slate-500">Last success</dt>
							<dd className="min-w-0 text-right break-words">
								{lastSuccessText(row.lastSuccessAt)}
							</dd>
							<dt className="text-slate-500">Details</dt>
							<dd className="min-w-0 text-right break-words text-slate-600">
								{row.reason ?? '—'}
							</dd>
						</dl>
					</li>
				))}
			</ul>
			<table className="hidden w-full table-fixed text-left text-xs sm:table">
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
							<th
								scope="row"
								className="py-1.5 pr-3 font-normal break-words"
							>
								{row.label}
							</th>
							<td
								className={`py-1.5 pr-3 break-words ${row.needsAttention ? '${ATTENTION_TEXT} font-medium' : ''}`}
							>
								{row.statusLabel}
							</td>
							<td className="py-1.5 pr-3 tabular-nums">
								{row.recordCount}
							</td>
							<td className="py-1.5 pr-3 break-words">
								{lastSuccessText(row.lastSuccessAt)}
							</td>
							<td className="py-1.5 break-words text-slate-600">
								{row.reason ?? '—'}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function lastSuccessText(lastSuccessAt: number | null): string {
	return lastSuccessAt
		? (formatDateTime(new Date(lastSuccessAt * 1000)) ?? 'Never')
		: 'Never'
}
