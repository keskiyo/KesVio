export const CATALOG_DENSITIES = ['comfortable', 'compact', 'dense'] as const

export type CatalogDensity = (typeof CATALOG_DENSITIES)[number]

export const DEFAULT_CATALOG_DENSITY: CatalogDensity = 'compact'
