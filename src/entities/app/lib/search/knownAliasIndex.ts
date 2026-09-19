import { KNOWN_APP_ALIASES } from './knownAppAliases'
import {
	knownPackageEntries,
	knownPackageGeneration,
} from './knownPackageIndex'
import type { AppMatchFacts, KnownAppAliasEntry, MatchClause } from './types'

const PREFIX_KEY_LENGTH = 2

interface KnownAliasIndex {
	generation: number
	byExactKey: Map<string, KnownAppAliasEntry[]>
	byPrefixKey: Map<string, KnownAppAliasEntry[]>
}

let index: KnownAliasIndex | null = null

function collectKeys(clause: MatchClause, exact: string[], prefixed: string[]) {
	if ('allOf' in clause) {
		for (const member of clause.allOf) collectKeys(member, exact, prefixed)
		return
	}
	if ('packageFamily' in clause) exact.push(...clause.packageFamily)
	else if ('steamAppId' in clause) exact.push(...clause.steamAppId)
	else if ('executable' in clause) exact.push(...clause.executable)
	else if ('productName' in clause) exact.push(...clause.productName)
	else if ('name' in clause) exact.push(...clause.name)
	else if ('productNameStartsWith' in clause)
		prefixed.push(...clause.productNameStartsWith)
	else if ('nameStartsWith' in clause) prefixed.push(...clause.nameStartsWith)
}

function file(
	map: Map<string, KnownAppAliasEntry[]>,
	key: string,
	entry: KnownAppAliasEntry,
) {
	const list = map.get(key)
	if (!list) map.set(key, [entry])
	else if (!list.includes(entry)) list.push(entry)
}

function buildIndex(): KnownAliasIndex {
	const byExactKey = new Map<string, KnownAppAliasEntry[]>()
	const byPrefixKey = new Map<string, KnownAppAliasEntry[]>()
	for (const entry of [...KNOWN_APP_ALIASES, ...knownPackageEntries()]) {
		const exact: string[] = []
		const prefixed: string[] = []
		for (const clause of entry.match.anyOf)
			collectKeys(clause, exact, prefixed)
		exact.push(...(entry.match.nameOnly ?? []))
		for (const key of exact) file(byExactKey, key, entry)
		for (const prefix of prefixed)
			file(byPrefixKey, prefix.slice(0, PREFIX_KEY_LENGTH), entry)
	}
	return { generation: knownPackageGeneration(), byExactKey, byPrefixKey }
}

export function candidateKnownEntries(
	facts: AppMatchFacts,
): Set<KnownAppAliasEntry> {
	if (!index || index.generation !== knownPackageGeneration()) {
		index = buildIndex()
		if (typeof performance.mark === 'function')
			performance.mark('kesvio:alias-reverse-index-built')
	}
	const candidates = new Set<KnownAppAliasEntry>()
	for (const key of [
		facts.pathExecutable,
		facts.product,
		facts.packageFamily,
		facts.steamAppId,
		...facts.names,
	])
		if (key)
			for (const entry of index.byExactKey.get(key) ?? [])
				candidates.add(entry)
	for (const value of [facts.name, facts.product])
		if (value.length >= PREFIX_KEY_LENGTH)
			for (const entry of index.byPrefixKey.get(
				value.slice(0, PREFIX_KEY_LENGTH),
			) ?? [])
				candidates.add(entry)
	return candidates
}
