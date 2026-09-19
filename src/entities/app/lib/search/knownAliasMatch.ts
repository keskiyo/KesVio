import type { AppInfo } from '../../model/app.types'
import {
	metadataFileName,
	normalizeIdentityFact,
	packageFamilyOf,
	pathFileName,
	steamAppIdOf,
	stripTrailingVersion,
} from './aliasText'
import { isHelperRecord } from './helperRecords'
import type {
	AppMatchFacts,
	KnownAppAliasEntry,
	MatchClause,
	MatchStrength,
} from './types'

type ClauseOutcome = MatchStrength | 'support' | 'miss'

const STRENGTH_RANK: Record<MatchStrength, number> = {
	strong: 3,
	normal: 2,
	weak: 1,
	none: 0,
}

export function appMatchFacts(app: AppInfo): AppMatchFacts {
	const name = normalizeIdentityFact(app.name)
	const versionless = stripTrailingVersion(name)
	return {
		name,
		names: [...new Set([name, versionless])],
		product: normalizeIdentityFact(app.productName ?? ''),
		publisher: normalizeIdentityFact(app.publisher ?? ''),
		pathExecutable: pathFileName(app),
		originalFilename: metadataFileName(app),
		packageFamily: packageFamilyOf(app),
		steamAppId: steamAppIdOf(app),
		artifact:
			app.artifactKind !== undefined &&
			app.artifactKind !== 'application',
	}
}

function clauseOutcome(
	clause: MatchClause,
	facts: AppMatchFacts,
): ClauseOutcome {
	if ('allOf' in clause) return allOfOutcome(clause.allOf, facts)
	if ('packageFamily' in clause)
		return facts.packageFamily &&
			clause.packageFamily.includes(facts.packageFamily)
			? 'strong'
			: 'miss'
	if ('steamAppId' in clause)
		return facts.steamAppId && clause.steamAppId.includes(facts.steamAppId)
			? 'strong'
			: 'miss'
	if ('executable' in clause)
		return facts.pathExecutable &&
			clause.executable.includes(facts.pathExecutable)
			? 'strong'
			: 'miss'
	if ('productName' in clause)
		return facts.product && clause.productName.includes(facts.product)
			? 'normal'
			: 'miss'
	if ('name' in clause)
		return clause.name.some(candidate => facts.names.includes(candidate))
			? 'normal'
			: 'miss'
	if ('productNameStartsWith' in clause)
		return facts.product &&
			clause.productNameStartsWith.some(prefix =>
				facts.product.startsWith(prefix),
			)
			? 'none'
			: 'miss'
	if ('nameStartsWith' in clause)
		return clause.nameStartsWith.some(prefix =>
			facts.name.startsWith(prefix),
		)
			? 'none'
			: 'miss'
	if ('publisherContains' in clause)
		return facts.publisher &&
			clause.publisherContains.some(part =>
				facts.publisher.includes(part),
			)
			? 'support'
			: 'miss'
	return facts.originalFilename &&
		clause.originalFilename.includes(facts.originalFilename)
		? 'support'
		: 'miss'
}

function allOfOutcome(
	clauses: readonly MatchClause[],
	facts: AppMatchFacts,
): ClauseOutcome {
	let best: MatchStrength | null = null
	let supported = false
	for (const clause of clauses) {
		const outcome = clauseOutcome(clause, facts)
		if (outcome === 'miss') return 'miss'
		if (outcome === 'support') supported = true
		else if (!best || STRENGTH_RANK[outcome] > STRENGTH_RANK[best])
			best = outcome
	}
	if (!best) return 'support'
	if (!supported) return best
	if (best === 'none') return 'normal'
	return 'strong'
}

function asStrength(outcome: ClauseOutcome): MatchStrength {
	return outcome === 'support' || outcome === 'miss' ? 'none' : outcome
}

export function matchKnownEntry(
	entry: KnownAppAliasEntry,
	facts: AppMatchFacts,
): MatchStrength {
	let best: MatchStrength = 'none'
	for (const clause of entry.match.anyOf) {
		const strength = asStrength(clauseOutcome(clause, facts))
		if (STRENGTH_RANK[strength] > STRENGTH_RANK[best]) best = strength
		if (best === 'strong') break
	}
	if (
		best === 'none' &&
		entry.match.nameOnly?.some(candidate => facts.names.includes(candidate))
	)
		best = 'weak'
	if (best === 'none') return best
	if (isHelperRecord(facts)) return 'none'
	for (const clause of entry.match.exclude ?? [])
		if (clauseOutcome(clause, facts) !== 'miss') return 'none'
	return best
}

export function clauseStrengthCeiling(clause: MatchClause): MatchStrength {
	if ('allOf' in clause) {
		let best: MatchStrength = 'none'
		let supported = false
		for (const member of clause.allOf) {
			if ('publisherContains' in member || 'originalFilename' in member)
				supported = true
			const ceiling = clauseStrengthCeiling(member)
			if (STRENGTH_RANK[ceiling] > STRENGTH_RANK[best]) best = ceiling
		}
		if (!supported) return best
		return best === 'none' ? 'normal' : 'strong'
	}
	if (
		'packageFamily' in clause ||
		'steamAppId' in clause ||
		'executable' in clause
	)
		return 'strong'
	if ('productName' in clause || 'name' in clause) return 'normal'
	return 'none'
}
