import type { AppInfo } from '../../model/app.types'
import { normalizeSearchAlias } from './aliasText'
import { generateAppAliases } from './generatedAliases'
import { candidateKnownEntries } from './knownAliasIndex'
import { appMatchFacts, matchKnownEntry } from './knownAliasMatch'
import type {
	AliasConfidence,
	AppMatchFacts,
	KnownEntryMatch,
	MatchStrength,
	SearchAlias,
} from './types'

const CONFIDENCE_RANK: Record<AliasConfidence, number> = {
	strong: 3,
	normal: 2,
	weak: 1,
}

export function grantedConfidence(
	declared: AliasConfidence,
	strength: Exclude<MatchStrength, 'none'>,
): AliasConfidence {
	return strength === 'normal' && declared === 'strong' ? 'normal' : declared
}

export function matchedKnownEntries(
	app: AppInfo,
	facts: AppMatchFacts = appMatchFacts(app),
): KnownEntryMatch[] {
	const matches: KnownEntryMatch[] = []
	for (const entry of candidateKnownEntries(facts)) {
		const strength = matchKnownEntry(entry, facts)
		if (strength !== 'none') matches.push({ entry, strength })
	}
	return matches
}

export function resolveSearchAliases(app: AppInfo): SearchAlias[] {
	const name = normalizeSearchAlias(app.name)
	const merged = new Map<string, AliasConfidence>()
	const consider = (value: string, confidence: AliasConfidence) => {
		const normalized = normalizeSearchAlias(value)
		if (!normalized || normalized === name) return
		const current = merged.get(normalized)
		if (!current || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[current])
			merged.set(normalized, confidence)
	}
	const facts = appMatchFacts(app)
	for (const { entry, strength } of matchedKnownEntries(app, facts))
		for (const [value, confidence] of entry.aliases)
			consider(value, grantedConfidence(confidence, strength))
	for (const alias of generateAppAliases(app, facts))
		consider(alias.value, alias.confidence)
	return [...merged]
		.map(([value, confidence]) => ({ value, confidence }))
		.sort(
			(left, right) =>
				CONFIDENCE_RANK[right.confidence] -
				CONFIDENCE_RANK[left.confidence],
		)
}
