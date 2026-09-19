export type AliasConfidence = 'strong' | 'normal' | 'weak'

export interface SearchAlias {
	value: string
	confidence: AliasConfidence
}

export type MatchStrength = 'strong' | 'normal' | 'weak' | 'none'

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

export type AliasSource = 'curated' | 'external'

export interface KnownAppAliasEntry {
	id: string
	match: {
		anyOf: readonly MatchClause[]
		exclude?: readonly MatchClause[]
		nameOnly?: readonly string[]
	}
	aliases: readonly (readonly [string, AliasConfidence])[]
	source?: AliasSource
	blockedAliases?: readonly string[]
}

export interface KnownPackageIndexData {
	version: number
	source: string
	commit: string
	generator: number
	strings: string[]
	records: KnownPackageRecordData[]
}

export type KnownPackageRecordData = [
	id: number,
	names: number[],
	soloNames: number[],
	publishers: number[],
	families: number[],
	executables: number[],
	aliases: number[],
]

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
