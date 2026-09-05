import {
	CATALOG_DENSITIES,
	type CatalogDensity,
} from '../../../../entities/app'
import type { DensityControlProps } from '../../types'

const DENSITY_LABELS: Record<CatalogDensity, string> = {
	comfortable: 'Comfortable',
	compact: 'Compact',
	dense: 'Dense',
}

export function DensityControl({ density, onSelect }: DensityControlProps) {
	return (
		<fieldset
			data-selected={density}
			className="relative mt-4 grid min-h-11 w-full grid-cols-3 rounded-xl border border-(--border-neutral) bg-(--surface-inset) p-1"
		>
			<legend className="sr-only">Catalog density</legend>
			<span className="density-thumb" aria-hidden="true" />
			{CATALOG_DENSITIES.map(value => (
				<label key={value} className="relative z-1">
					<input
						type="radio"
						name="catalog-density"
						value={value}
						checked={density === value}
						onChange={() => onSelect(value)}
						className="peer sr-only"
					/>
					<span className="block cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-medium text-(--text-muted) transition-colors peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--accent-strong)">
						{DENSITY_LABELS[value]}
					</span>
				</label>
			))}
		</fieldset>
	)
}
