import type {
	AliasConfidence,
	KnownAppAliasEntry,
	KnownPackageIndexData,
	KnownPackageRecordData,
	MatchClause,
} from './types'

export type KnownPackageIndexStatus = 'idle' | 'loading' | 'ready' | 'failed'

const EXTERNAL_CONFIDENCE: readonly AliasConfidence[] = ['normal', 'weak']

let entries: KnownAppAliasEntry[] = []
let generation = 0
let status: KnownPackageIndexStatus = 'idle'
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

export function knownPackageEntries(): readonly KnownAppAliasEntry[] {
	return entries
}

export function knownPackageGeneration(): number {
	return generation
}

export function knownPackageIndexStatus(): KnownPackageIndexStatus {
	return status
}

export function subscribeKnownPackageIndex(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function decodeRecord(
	record: KnownPackageRecordData,
	strings: string[],
): KnownAppAliasEntry | null {
	if (!Array.isArray(record) || record.length < 7) return null
	const [id, names, soloNames, publishers, families, executables, aliases] =
		record
	if (typeof strings[id] !== 'string') return null
	const text = (indexes: number[]) =>
		Array.isArray(indexes)
			? indexes
					.map(index => strings[index])
					.filter(
						(value): value is string => typeof value === 'string',
					)
			: []
	const anyOf: MatchClause[] = []
	const publisherTokens = text(publishers)
	const familyList = text(families)
	const executableList = text(executables)
	const nameList = text(names)
	if (familyList.length > 0) anyOf.push({ packageFamily: familyList })
	if (executableList.length > 0 && publisherTokens.length > 0)
		anyOf.push({
			allOf: [
				{ executable: executableList },
				{ publisherContains: publisherTokens },
			],
		})
	if (nameList.length > 0 && publisherTokens.length > 0)
		anyOf.push({
			allOf: [{ name: nameList }, { publisherContains: publisherTokens }],
		})
	const nameOnly = text(soloNames)
	const decodedAliases: (readonly [string, AliasConfidence])[] = []
	if (!Array.isArray(aliases)) return null
	for (let index = 0; index + 1 < aliases.length; index += 2) {
		const value = strings[aliases[index]!]
		const confidence = EXTERNAL_CONFIDENCE[aliases[index + 1]!]
		if (typeof value === 'string' && confidence)
			decodedAliases.push([value, confidence])
	}
	if (
		(anyOf.length === 0 && nameOnly.length === 0) ||
		decodedAliases.length === 0
	)
		return null
	return {
		id: `winget:${strings[id]}`,
		match: nameOnly.length > 0 ? { anyOf, nameOnly } : { anyOf },
		aliases: decodedAliases,
		source: 'external',
	}
}

export function decodeKnownPackageIndex(
	data: KnownPackageIndexData,
): KnownAppAliasEntry[] {
	if (
		!data ||
		data.version !== 1 ||
		!Array.isArray(data.records) ||
		!Array.isArray(data.strings)
	)
		return []
	const decoded: KnownAppAliasEntry[] = []
	for (const record of data.records) {
		const entry = decodeRecord(record, data.strings)
		if (entry) decoded.push(entry)
	}
	return decoded
}

export function installKnownPackageEntries(next: KnownAppAliasEntry[]): void {
	entries = next
	generation += 1
	status = next.length > 0 ? 'ready' : 'failed'
	for (const listener of listeners) listener()
}

function markTiming(name: string): void {
	if (typeof performance.mark === 'function') performance.mark(name)
}

export function loadKnownPackageIndex(): Promise<void> {
	if (loading) return loading
	status = 'loading'
	markTiming('kesvio:alias-index-import-begin')
	loading = import('./generated/knownPackages')
		.then(module => {
			const decoded = decodeKnownPackageIndex(module.KNOWN_PACKAGE_INDEX)
			markTiming('kesvio:alias-index-decode-done')
			installKnownPackageEntries(decoded)
			markTiming('kesvio:alias-index-installed')
		})
		.catch(() => {
			installKnownPackageEntries([])
		})
	return loading
}
