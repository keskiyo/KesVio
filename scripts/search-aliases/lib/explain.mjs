// Explains why a record ranks for a query, in the same order the scorer checks its fields. The
// total score always comes from the real scorer; this module only names the field, alias,
// source and query variant behind it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { queryTokenVariants } from '../../../src/shared/lib/searchQueryVariants.ts'
import { scoreApp } from '../../../src/entities/app/lib/search/scoring.ts'
import { fieldsFor } from '../../../src/entities/app/lib/search/searchFields.ts'
import { generateAppAliases } from '../../../src/entities/app/lib/search/generatedAliases.ts'
import { helperReason } from '../../../src/entities/app/lib/search/helperRecords.ts'
import { appMatchFacts } from '../../../src/entities/app/lib/search/knownAliasMatch.ts'
import {
	decodeKnownPackageIndex,
	installKnownPackageEntries,
} from '../../../src/entities/app/lib/search/knownPackageIndex.ts'
import {
	matchedKnownEntries,
	resolveSearchAliases,
} from '../../../src/entities/app/lib/search/resolveSearchAliases.ts'

const GENERATED = join(
	process.cwd(),
	'src',
	'entities',
	'app',
	'lib',
	'search',
	'generated',
	'knownPackages.json',
)

export function installShippedIndex() {
	const data = JSON.parse(readFileSync(GENERATED, 'utf8'))
	installKnownPackageEntries(decodeKnownPackageIndex(data))
	return data
}

export function queryTokens(query) {
	return query
		.trim()
		.toLocaleLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.map(value => ({ value, variants: queryTokenVariants(value) }))
}

export function aliasSources(app) {
	const facts = appMatchFacts(app)
	const sources = new Map()
	const matches = matchedKnownEntries(app, facts)
	for (const { entry, strength } of matches) {
		const source = entry.source === 'external' ? 'external' : 'curated'
		for (const [value] of entry.aliases)
			if (!sources.has(value) || source === 'curated')
				sources.set(value, { source, entry: entry.id, strength })
	}
	for (const alias of generateAppAliases(app, facts))
		if (!sources.has(alias.value))
			sources.set(alias.value, {
				source: 'generated',
				entry: null,
				strength: null,
			})
	return { facts, matches, sources }
}

function directMatch(fields, token) {
	if (fields.name === token) return { kind: 'exact name' }
	const exact = fields.aliasExact.get(token)
	if (fields.name.startsWith(token))
		return {
			kind:
				exact === 'strong'
					? 'name prefix + strong alias'
					: 'name prefix',
		}
	if (exact) return { kind: 'alias exact', alias: token, confidence: exact }
	const strongPrefix = fields.strongAliases.find(alias =>
		alias.startsWith(token),
	)
	if (strongPrefix)
		return {
			kind: 'alias prefix',
			alias: strongPrefix,
			confidence: 'strong',
		}
	if (fields.nameWords.some(word => word.startsWith(token)))
		return { kind: 'name word prefix' }
	const normalPrefix = fields.normalAliases.find(alias =>
		alias.startsWith(token),
	)
	if (normalPrefix)
		return {
			kind: 'alias prefix',
			alias: normalPrefix,
			confidence: 'normal',
		}
	if (fields.name.includes(token) || fields.product.includes(token))
		return { kind: 'name/product substring' }
	if (fields.publisher.includes(token)) return { kind: 'publisher' }
	if (token.length >= 3 && fields.secondary.includes(token))
		return { kind: 'secondary (path / description / version)' }
	return null
}

export function explainMatch(app, tokens) {
	const fields = fieldsFor(app)
	const { sources } = aliasSources(app)
	const perToken = tokens.map(token => {
		for (let index = 0; index < token.variants.length; index += 1) {
			const hit = directMatch(fields, token.variants[index])
			if (hit)
				return {
					token: token.value,
					variant: token.variants[index],
					variantKind: index === 0 ? 'literal' : 'corrected',
					...hit,
					...(hit.alias ? (sources.get(hit.alias) ?? {}) : {}),
				}
		}
		return {
			token: token.value,
			variant: null,
			variantKind: null,
			kind: 'fuzzy (one edit) or phrase',
		}
	})
	return { score: scoreApp(fields, tokens), perToken }
}

export function describeApp(app) {
	const { facts, matches, sources } = aliasSources(app)
	const reason = helperReason(facts)
	return {
		facts,
		generated: generateAppAliases(app, facts),
		curated: matches
			.filter(match => match.entry.source !== 'external')
			.map(match => ({
				entry: match.entry.id,
				strength: match.strength,
				aliases: match.entry.aliases,
			})),
		external: matches
			.filter(match => match.entry.source === 'external')
			.map(match => ({
				package: match.entry.id,
				strength: match.strength,
				aliases: match.entry.aliases,
			})),
		final: resolveSearchAliases(app).map(alias => ({
			...alias,
			source: sources.get(alias.value)?.source ?? 'generated',
		})),
		helper: reason,
	}
}
