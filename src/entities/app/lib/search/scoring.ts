import { isWithinOneEdit } from '../../../../shared/lib/searchQueryVariants'
import { MIN_FUZZY_LENGTH, type SearchFields } from './searchFields'
import type { AliasConfidence } from './types'

export const SEARCH_SCORE = {
	exactName: 100,
	namePrefixWithStrongAlias: 95,
	namePrefix: 90,
	strongAliasExact: 88,
	normalAliasExact: 80,
	strongAliasPrefix: 76,
	nameWordPrefix: 70,
	normalAliasPrefix: 66,
	weakAliasExact: 58,
	nameSubstring: 50,
	publisher: 30,
	secondary: 10,
	literalVariant: 200,
	correctedVariant: 100,
	fuzzyLiteral: 50,
	fuzzyCorrected: 40,
	phraseBonus: 50,
} as const

const MIN_SECONDARY_LENGTH = 3

export interface QueryToken {
	value: string
	variants: string[]
}

const EXACT_ALIAS_SCORE: Record<AliasConfidence, number> = {
	strong: SEARCH_SCORE.strongAliasExact,
	normal: SEARCH_SCORE.normalAliasExact,
	weak: SEARCH_SCORE.weakAliasExact,
}

const PREFIX_ALIAS_SCORE: Record<AliasConfidence, number> = {
	strong: SEARCH_SCORE.strongAliasPrefix,
	normal: SEARCH_SCORE.normalAliasPrefix,
	weak: 0,
}

function hasPrefix(values: string[], token: string): boolean {
	for (const value of values) if (value.startsWith(token)) return true
	return false
}

function directScore(fields: SearchFields, token: string): number {
	if (fields.name === token) return SEARCH_SCORE.exactName
	const exact = fields.aliasExact.get(token)
	if (fields.name.startsWith(token))
		return exact === 'strong'
			? SEARCH_SCORE.namePrefixWithStrongAlias
			: SEARCH_SCORE.namePrefix
	if (exact) return EXACT_ALIAS_SCORE[exact]
	if (hasPrefix(fields.strongAliases, token))
		return SEARCH_SCORE.strongAliasPrefix
	if (hasPrefix(fields.nameWords, token)) return SEARCH_SCORE.nameWordPrefix
	if (hasPrefix(fields.normalAliases, token))
		return SEARCH_SCORE.normalAliasPrefix
	if (fields.name.includes(token) || fields.product.includes(token))
		return SEARCH_SCORE.nameSubstring
	if (fields.publisher.includes(token)) return SEARCH_SCORE.publisher
	if (
		token.length >= MIN_SECONDARY_LENGTH &&
		fields.secondary.includes(token)
	)
		return SEARCH_SCORE.secondary
	return 0
}

function variantBonus(index: number): number {
	return index === 0
		? SEARCH_SCORE.literalVariant
		: SEARCH_SCORE.correctedVariant
}

function tokenScore(fields: SearchFields, token: QueryToken): number {
	for (let index = 0; index < token.variants.length; index += 1) {
		const score = directScore(fields, token.variants[index])
		if (score > 0) return score + variantBonus(index)
	}
	if (token.value.length < MIN_FUZZY_LENGTH) return 0
	for (let index = 0; index < token.variants.length; index += 1)
		if (
			fields.words.some(word =>
				isWithinOneEdit(token.variants[index], word),
			)
		)
			return index === 0
				? SEARCH_SCORE.fuzzyLiteral
				: SEARCH_SCORE.fuzzyCorrected
	return 0
}

function phraseVariants(tokens: QueryToken[]): string[] {
	const depth = Math.max(...tokens.map(token => token.variants.length))
	const phrases: string[] = []
	for (let index = 0; index < depth; index += 1)
		phrases.push(
			tokens.map(token => token.variants[index] ?? token.value).join(' '),
		)
	return phrases
}

function phraseScore(fields: SearchFields, tokens: QueryToken[]): number {
	if (fields.phrases.length === 0) return 0
	const variants = phraseVariants(tokens)
	let best = 0
	for (let index = 0; index < variants.length; index += 1) {
		const phrase = variants[index]
		for (const alias of fields.phrases) {
			const exact = alias.value === phrase
			const perToken = exact
				? EXACT_ALIAS_SCORE[alias.confidence]
				: alias.value.startsWith(phrase)
					? PREFIX_ALIAS_SCORE[alias.confidence]
					: 0
			if (perToken === 0) continue
			const total =
				tokens.length * (perToken + variantBonus(index)) +
				(exact ? SEARCH_SCORE.phraseBonus : 0)
			if (total > best) best = total
		}
	}
	return best
}

export function scoreApp(fields: SearchFields, tokens: QueryToken[]): number {
	let total = 0
	for (const token of tokens) {
		const score = tokenScore(fields, token)
		if (score === 0) {
			total = 0
			break
		}
		total += score
	}
	if (tokens.length === 1) return total
	return Math.max(total, phraseScore(fields, tokens))
}
