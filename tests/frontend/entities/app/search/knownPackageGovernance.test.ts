import { beforeAll, describe, expect, it } from 'vitest'
import {
	FORBIDDEN_ALIAS_VALUES,
	GENERIC_NAMES,
	GENERIC_WORDS,
	HOST_STEMS,
} from '../../../../../src/entities/app/lib/search/aliasPolicy'
import { KNOWN_PACKAGE_INDEX } from '../../../../../src/entities/app/lib/search/generated/knownPackages'
import { stripTrailingVersion } from '../../../../../src/entities/app/lib/search/aliasText'
import { isHelperRecord } from '../../../../../src/entities/app/lib/search/helperRecords'
import { KNOWN_APP_ALIASES } from '../../../../../src/entities/app/lib/search/knownAppAliases'
import { appMatchFacts } from '../../../../../src/entities/app/lib/search/knownAliasMatch'
import {
	decodeKnownPackageIndex,
	loadKnownPackageIndex,
} from '../../../../../src/entities/app/lib/search/knownPackageIndex'
import { generateAppAliases } from '../../../../../src/entities/app/lib/search/generatedAliases'
import { resolveSearchAliases } from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import type { KnownAppAliasEntry } from '../../../../../src/entities/app/lib/search/types'
import { app } from './fixtures/app'

const MAX_SHIPPED_COLLISION = 3
const MAX_ALIASES_PER_RECORD = 10
const HOLDOUT_MODULUS = 10
const URL_LIKE = /:\/\/|www\.|<http|mailto:/
const PATH_LIKE = /[\\/]/
const INSTALLER_SWITCH = /^[-/]/

function fnv1a(value: string): number {
	let hash = 0x811c9dc5
	for (const character of value) {
		hash ^= character.codePointAt(0)!
		hash = Math.imul(hash, 0x01000193) >>> 0
	}
	return hash
}

function identityOf(entry: KnownAppAliasEntry) {
	let name: string | undefined
	let publisher: string | undefined
	for (const clause of entry.match.anyOf) {
		if (!('allOf' in clause)) continue
		for (const member of clause.allOf) {
			if ('name' in member) name ??= member.name[0]
			if ('publisherContains' in member)
				publisher ??= member.publisherContains[0]
		}
	}
	return { name: name ?? entry.match.nameOnly?.[0], publisher }
}

// Every record the generator emits must obey the same rules the curated dictionary obeys, and
// a deterministic 10 % holdout of the corpus (chosen by a hash of the package id, never by hand)
// must resolve safely when the record is turned into the AppInfo an installer would register.
describe('known package index governance', () => {
	let entries: KnownAppAliasEntry[] = []
	const curatedStrong = new Set<string>()
	const curatedOwned = new Set<string>()
	const curatedNames = new Set<string>()

	beforeAll(async () => {
		await loadKnownPackageIndex()
		entries = decodeKnownPackageIndex(KNOWN_PACKAGE_INDEX)
		for (const entry of KNOWN_APP_ALIASES) {
			for (const [value, confidence] of entry.aliases) {
				curatedOwned.add(value)
				if (confidence === 'strong') curatedStrong.add(value)
			}
			for (const clause of entry.match.anyOf)
				if ('name' in clause)
					clause.name.forEach(value => curatedNames.add(value))
		}
	})

	it('pins the upstream snapshot it was generated from', () => {
		expect(KNOWN_PACKAGE_INDEX.version).toBe(1)
		expect(KNOWN_PACKAGE_INDEX.source).toBe('microsoft/winget-pkgs')
		expect(KNOWN_PACKAGE_INDEX.commit).toMatch(/^[0-9a-f]{40}$/)
		expect(KNOWN_PACKAGE_INDEX.generator).toBe(2)
		expect(entries.length).toBeGreaterThan(5000)
	})

	it('marks every record external and never grants strong', () => {
		for (const entry of entries) {
			expect(entry.source).toBe('external')
			for (const [, confidence] of entry.aliases)
				expect(confidence, entry.id).not.toBe('strong')
		}
	})

	it('carries no forbidden, generic, host, url, path, switch or too-short alias', () => {
		const offenders: string[] = []
		for (const entry of entries)
			for (const [value] of entry.aliases) {
				if ([...value].length < 3)
					offenders.push(`${entry.id}: short ${value}`)
				if (FORBIDDEN_ALIAS_VALUES.has(value))
					offenders.push(`${entry.id}: semantic ${value}`)
				if (GENERIC_WORDS.has(value) || GENERIC_NAMES.has(value))
					offenders.push(`${entry.id}: generic ${value}`)
				if (HOST_STEMS.has(value))
					offenders.push(`${entry.id}: host ${value}`)
				if (URL_LIKE.test(value))
					offenders.push(`${entry.id}: url ${value}`)
				if (PATH_LIKE.test(value))
					offenders.push(`${entry.id}: path ${value}`)
				if (INSTALLER_SWITCH.test(value))
					offenders.push(`${entry.id}: switch ${value}`)
				if (value !== value.trim().toLocaleLowerCase())
					offenders.push(`${entry.id}: not normalized ${value}`)
			}
		expect(offenders).toEqual([])
	})

	it('never competes with a curated strong alias or a curated identity name', () => {
		const offenders: string[] = []
		for (const entry of entries)
			for (const [value] of entry.aliases)
				if (curatedStrong.has(value))
					offenders.push(`${entry.id}: ${value}`)
		expect(offenders).toEqual([])
		for (const entry of entries)
			for (const value of entry.match.nameOnly ?? [])
				expect(
					curatedNames.has(value),
					`${entry.id} solo name ${value}`,
				).toBe(false)
	})

	it('ships at most ten aliases per record and no alias equal to every name it can be identified by', () => {
		for (const entry of entries) {
			expect(entry.aliases.length, entry.id).toBeLessThanOrEqual(
				MAX_ALIASES_PER_RECORD,
			)
			const names = new Set<string>(entry.match.nameOnly ?? [])
			for (const clause of entry.match.anyOf)
				if ('allOf' in clause)
					for (const member of clause.allOf)
						if ('name' in member)
							member.name.forEach(value => names.add(value))
			if (names.size === 1)
				for (const [value] of entry.aliases)
					expect(names.has(value), `${entry.id} ${value}`).toBe(false)
		}
	})

	it('keeps shipped collisions within the policy', () => {
		const owners = new Map<string, string[]>()
		for (const entry of entries)
			for (const [value] of entry.aliases)
				owners.set(value, [...(owners.get(value) ?? []), entry.id])
		const heavy = [...owners].filter(
			([, ids]) => ids.length > MAX_SHIPPED_COLLISION,
		)
		expect(heavy.map(([value, ids]) => `${value}: ${ids.length}`)).toEqual(
			[],
		)
		let normalCollisions = 0
		for (const entry of entries)
			for (const [value, confidence] of entry.aliases)
				if (
					confidence === 'normal' &&
					(owners.get(value)?.length ?? 0) > 1
				)
					normalCollisions += 1
		expect(normalCollisions).toBe(0)
	})

	it('uses only identity clauses the runtime model allows and never identity by name alone', () => {
		for (const entry of entries) {
			expect(
				entry.match.anyOf.length + (entry.match.nameOnly?.length ?? 0),
				entry.id,
			).toBeGreaterThan(0)
			for (const clause of entry.match.anyOf) {
				if ('allOf' in clause) {
					const kinds = clause.allOf.map(
						member => Object.keys(member)[0],
					)
					expect(kinds).toContain('publisherContains')
					expect(
						kinds.some(
							kind => kind === 'name' || kind === 'executable',
						),
					).toBe(true)
				} else expect(Object.keys(clause)[0]).toBe('packageFamily')
			}
			for (const value of entry.match.nameOnly ?? [])
				expect(
					[...value].length,
					`${entry.id} ${value}`,
				).toBeGreaterThanOrEqual(4)
		}
	})

	it('resolves a deterministic holdout of the corpus safely', () => {
		const holdout = entries.filter(
			entry => fnv1a(entry.id) % HOLDOUT_MODULUS === 0,
		)
		const summary = {
			total: holdout.length,
			withUsefulAlias: 0,
			resolved: 0,
			skippedHelper: 0,
			nameOnlyWeak: 0,
			suspicious: [] as string[],
		}
		for (const entry of holdout) {
			const { name, publisher } = identityOf(entry)
			if (!name) continue
			const corroborated = app({ id: entry.id, name, publisher })
			const aliases = resolveSearchAliases(corroborated)
			for (const alias of aliases) {
				if (
					alias.confidence === 'strong' &&
					!curatedStrong.has(alias.value)
				)
					summary.suspicious.push(`${entry.id} strong ${alias.value}`)
				if (FORBIDDEN_ALIAS_VALUES.has(alias.value))
					summary.suspicious.push(
						`${entry.id} semantic ${alias.value}`,
					)
				if (
					!curatedOwned.has(alias.value) &&
					HOST_STEMS.has(alias.value) &&
					stripTrailingVersion(name) !== alias.value
				)
					summary.suspicious.push(`${entry.id} host ${alias.value}`)
			}
			const expected = entry.aliases
				.map(([value]) => value)
				.filter(value => value !== name)
			if (expected.length === 0) continue
			summary.withUsefulAlias += 1
			const hit = expected.some(value =>
				aliases.some(alias => alias.value === value),
			)
			if (hit) summary.resolved += 1
			else if (isHelperRecord(appMatchFacts(corroborated)))
				summary.skippedHelper += 1
			else
				summary.suspicious.push(
					`${entry.id} resolved none of ${expected.join(', ')}`,
				)
			if (entry.match.nameOnly?.includes(name)) {
				const bareRecord = app({ id: entry.id, name })
				const bare = resolveSearchAliases(bareRecord)
				const ownGenerated = new Set(
					generateAppAliases(bareRecord).map(alias => alias.value),
				)
				if (
					bare.some(
						alias =>
							alias.confidence === 'normal' &&
							expected.includes(alias.value) &&
							!ownGenerated.has(alias.value),
					)
				)
					summary.suspicious.push(`${entry.id} name-only gave normal`)
				else summary.nameOnlyWeak += 1
			}
		}
		expect(summary.suspicious).toEqual([])
		expect(summary.total).toBeGreaterThanOrEqual(500)
		expect(summary.withUsefulAlias).toBeGreaterThanOrEqual(400)
		expect(
			summary.resolved / summary.withUsefulAlias,
		).toBeGreaterThanOrEqual(0.9)
		expect(summary.resolved + summary.skippedHelper).toBe(
			summary.withUsefulAlias,
		)
	})
})
