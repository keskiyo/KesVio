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

const STRENGTH_CAP: Record<Exclude<MatchStrength, 'none'>, AliasConfidence> = {
	strong: 'strong',
	normal: 'normal',
	weak: 'weak',
}

export function grantedConfidence(
	declared: AliasConfidence,
	strength: Exclude<MatchStrength, 'none'>,
): AliasConfidence {
	const cap = STRENGTH_CAP[strength]
	return CONFIDENCE_RANK[declared] > CONFIDENCE_RANK[cap] ? cap : declared
}

export function externalConfidence(
	declared: AliasConfidence,
	strength: Exclude<MatchStrength, 'none'>,
): Exclude<AliasConfidence, 'strong'> {
	const granted = grantedConfidence(
		declared === 'weak' ? 'weak' : 'normal',
		strength,
	)
	return granted === 'strong' ? 'normal' : granted
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
	const decided = new Set<string>()
	const blocked = new Set<string>()
	const consider = (value: string, confidence: AliasConfidence) => {
		const normalized = normalizeSearchAlias(value)
		if (!normalized || normalized === name) return
		const current = merged.get(normalized)
		if (!current || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[current])
			merged.set(normalized, confidence)
	}
	const facts = appMatchFacts(app)
	const matches = matchedKnownEntries(app, facts)
	for (const { entry, strength } of matches) {
		if (entry.source === 'external') continue
		for (const value of entry.blockedAliases ?? [])
			blocked.add(normalizeSearchAlias(value))
		for (const [value, confidence] of entry.aliases) {
			decided.add(normalizeSearchAlias(value))
			consider(value, grantedConfidence(confidence, strength))
		}
	}
	for (const { entry, strength } of matches) {
		if (entry.source !== 'external') continue
		for (const [value, confidence] of entry.aliases) {
			const normalized = normalizeSearchAlias(value)
			if (decided.has(normalized) || blocked.has(normalized)) continue
			consider(normalized, externalConfidence(confidence, strength))
		}
	}
	for (const alias of generateAppAliases(app, facts))
		if (!decided.has(alias.value) && !blocked.has(alias.value))
			consider(alias.value, alias.confidence)
	return [...merged]
		.map(([value, confidence]) => ({ value, confidence }))
		.sort(
			(left, right) =>
				CONFIDENCE_RANK[right.confidence] -
				CONFIDENCE_RANK[left.confidence],
		)
}
