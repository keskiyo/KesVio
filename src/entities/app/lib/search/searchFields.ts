import type { AppInfo } from '../../model/app.types'
import { knownPackageGeneration } from './knownPackageIndex'
import { resolveSearchAliases } from './resolveSearchAliases'
import type { AliasConfidence, SearchAlias } from './types'

export const MIN_FUZZY_LENGTH = 4
export const MIN_STRONG_ALIAS_FUZZY_LENGTH = 5

export interface SearchFields {
	name: string
	nameWords: string[]
	product: string
	publisher: string
	secondary: string
	aliasExact: Map<string, AliasConfidence>
	strongAliases: string[]
	normalAliases: string[]
	phrases: SearchAlias[]
	words: string[]
}

let searchFields = new WeakMap<AppInfo, SearchFields>()
let cachedGeneration = knownPackageGeneration()

export function fieldsFor(app: AppInfo): SearchFields {
	if (cachedGeneration !== knownPackageGeneration()) {
		searchFields = new WeakMap()
		cachedGeneration = knownPackageGeneration()
	}
	const cached = searchFields.get(app)
	if (cached) return cached
	const name = app.name.toLocaleLowerCase()
	const product = (app.productName ?? '').toLocaleLowerCase()
	const aliasExact = new Map<string, AliasConfidence>()
	const strongAliases: string[] = []
	const normalAliases: string[] = []
	const phrases: SearchAlias[] = []
	for (const alias of resolveSearchAliases(app)) {
		aliasExact.set(alias.value, alias.confidence)
		if (alias.confidence === 'strong') strongAliases.push(alias.value)
		else if (alias.confidence === 'normal') normalAliases.push(alias.value)
		if (alias.value.includes(' ')) phrases.push(alias)
	}
	const fields: SearchFields = {
		name,
		nameWords: name.split(/[\s\-_.()[\]]+/),
		product,
		publisher: (app.publisher ?? '').toLocaleLowerCase(),
		aliasExact,
		strongAliases,
		normalAliases,
		phrases,
		secondary: [
			app.path,
			app.installLocation,
			app.version,
			app.description,
			app.visibilityReasons?.join(' '),
			app.visibilityReasons?.includes('product_component')
				? 'helper service component'
				: null,
			app.visibilityReasons?.includes('documentation_shortcut')
				? 'documentation docs'
				: null,
		]
			.filter(Boolean)
			.join(' ')
			.toLocaleLowerCase(),
		words: [
			...`${name} ${product}`
				.toLocaleLowerCase()
				.split(/[^\p{L}\p{N}]+/u)
				.filter(word => word.length >= MIN_FUZZY_LENGTH),
			...strongAliases.filter(
				alias =>
					!alias.includes(' ') &&
					alias.length >= MIN_STRONG_ALIAS_FUZZY_LENGTH,
			),
		],
	}
	searchFields.set(app, fields)
	return fields
}
