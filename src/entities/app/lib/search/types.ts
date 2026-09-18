export type AliasConfidence = 'strong' | 'normal' | 'weak'

export interface SearchAlias {
	value: string
	confidence: AliasConfidence
}

export type MatchStrength = 'strong' | 'normal' | 'none'

export type MatchClause =
	| { packageFamily: readonly string[] }
	| { steamAppId: readonly string[] }
	| { executable: readonly string[] }
	| { productName: readonly string[] }
	| { name: readonly string[] }
	| { productNameStartsWith: readonly string[] }
	| { nameStartsWith: readonly string[] }
	| { publisherContains: readonly string[] }
	| { originalFilename: readonly string[] }
	| { allOf: readonly MatchClause[] }

export interface KnownAppAliasEntry {
	id: string
	match: {
		anyOf: readonly MatchClause[]
		exclude?: readonly MatchClause[]
	}
	aliases: readonly (readonly [string, AliasConfidence])[]
}

export interface AppMatchFacts {
	name: string
	names: readonly string[]
	product: string
	publisher: string
	pathExecutable: string | null
	originalFilename: string | null
	packageFamily: string | null
	steamAppId: string | null
	artifact: boolean
}

export interface KnownEntryMatch {
	entry: KnownAppAliasEntry
	strength: Exclude<MatchStrength, 'none'>
}
