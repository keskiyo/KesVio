import { LayoutGrid } from 'lucide-react'
import { DensityControl } from '../components/DensityControl'
import type { CatalogDensityRowProps } from '../../types'

export function CatalogDensityRow({
	density,
	onSetDensity,
}: CatalogDensityRowProps) {
	return (
		<div className="border-b border-slate-200 p-5">
			<div className="flex items-center gap-4">
				<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-200/70 text-violet-700 shadow-inner">
					<LayoutGrid size={19} aria-hidden="true" />
				</span>
				<div className="min-w-0">
					<h2 className="font-medium">Catalog density</h2>
					<p className="mt-1 text-sm text-slate-600">
						Choose card size.
					</p>
				</div>
			</div>
			<DensityControl density={density} onSelect={onSetDensity} />
		</div>
	)
}
