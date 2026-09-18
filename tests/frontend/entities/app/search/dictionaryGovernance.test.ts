import { describe, expect, it } from 'vitest'
import { KNOWN_APP_ALIASES } from '../../../../../src/entities/app/lib/search/knownAppAliases'
import { clauseStrengthCeiling } from '../../../../../src/entities/app/lib/search/knownAliasMatch'
import type {
	AliasConfidence,
	KnownAppAliasEntry,
	MatchClause,
} from '../../../../../src/entities/app/lib/search/types'
import { queryTokenVariants } from '../../../../../src/shared/lib/searchQueryVariants'
import { ALIAS_GOLDEN_QUERIES } from './fixtures/aliasGoldenQueries'

// Every collision below is deliberate and documented; a new one fails this file until it is
// added here with a reason. Strong aliases never collide: an exact strong hit must name one app.
export const KNOWN_ALIAS_COLLISIONS: Record<
	string,
	{ entries: string[]; reason: string }
> = {
	powershell: {
		entries: ['windows-powershell', 'powershell-7'],
		reason: 'PowerShell 7 carries powershell only as a normal alias because its name already starts with the word; Windows PowerShell keeps the strong one',
	},
	mysql: {
		entries: ['mysql-server', 'mysql-workbench'],
		reason: 'Workbench carries mysql only as a normal alias; the server keeps the strong one',
	},
	nvidia: {
		entries: ['nvidia-app', 'nvidia-control-panel'],
		reason: 'Control Panel carries nvidia only as a normal alias; the NVIDIA App keeps the strong one',
	},
}

// Category words, file formats and vendor names are not aliases of one product.
const FORBIDDEN_ALIASES = new Set([
	'vpn',
	'torrent',
	'browser',
	'chat',
	'game',
	'games',
	'server',
	'manager',
	'console',
	'консоль',
	'магазин',
	'обои',
	'wallpaper',
	'mail',
	'почта',
	'pdf',
	'office',
	'офис',
	'screenshot',
	'скриншот',
	'antivirus',
	'антивирус',
	'архиватор',
	'mods',
	'llm',
	'ssh',
	'scp',
	'ftp',
	'linux',
	'security',
	'безопасность',
	'музыка',
	'music',
	'телефон',
	'phone',
	'задачи',
	'заметки',
	'notes',
	'feedback',
	'поддержка',
	'диктофон',
	'recorder',
	'события',
	'реестр',
	'диспетчер',
	'editor',
	'редактор',
	'player',
	'плеер',
	'video',
	'видео',
	'photo',
	'фото',
	'blizzard',
	'anthropic',
	'openai',
	'logitech',
	'google',
	'microsoft',
	'adobe',
	'oracle',
	'rar',
	'zip',
	'ppt',
	'exe',
	'ps1',
	'presentations',
	'презентации',
])

const rank: Record<AliasConfidence, number> = { strong: 3, normal: 2, weak: 1 }

function clauses(entry: KnownAppAliasEntry): MatchClause[] {
	const all: MatchClause[] = []
	const walk = (clause: MatchClause) => {
		all.push(clause)
		if ('allOf' in clause) clause.allOf.forEach(walk)
	}
	entry.match.anyOf.forEach(walk)
	entry.match.exclude?.forEach(walk)
	return all
}

function clauseValues(clause: MatchClause): readonly string[] {
	if ('allOf' in clause) return []
	return Object.values(clause)[0] as readonly string[]
}

function aliasOwners(): Map<
	string,
	{ id: string; confidence: AliasConfidence }[]
> {
	const owners = new Map<
		string,
		{ id: string; confidence: AliasConfidence }[]
	>()
	for (const entry of KNOWN_APP_ALIASES)
		for (const [value, confidence] of entry.aliases) {
			const list = owners.get(value) ?? []
			list.push({ id: entry.id, confidence })
			owners.set(value, list)
		}
	return owners
}

describe('dictionary structure', () => {
	it('is frozen with unique ids and non-empty alias lists', () => {
		expect(Object.isFrozen(KNOWN_APP_ALIASES)).toBe(true)
		expect(KNOWN_APP_ALIASES.length).toBeGreaterThanOrEqual(150)
		const ids = KNOWN_APP_ALIASES.map(entry => entry.id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const entry of KNOWN_APP_ALIASES) {
			expect(entry.aliases.length, entry.id).toBeGreaterThan(0)
			expect(entry.match.anyOf.length, entry.id).toBeGreaterThan(0)
		}
	})

	it('stores every matcher value and alias lowercase, trimmed and single-spaced', () => {
		for (const entry of KNOWN_APP_ALIASES) {
			for (const [value] of entry.aliases) {
				expect(value, entry.id).not.toBe('')
				expect(value, entry.id).toBe(value.trim().toLocaleLowerCase())
				expect(value, entry.id).not.toMatch(/\s{2,}/)
			}
			for (const clause of clauses(entry))
				for (const value of clauseValues(clause)) {
					expect(value, entry.id).not.toBe('')
					expect(value, entry.id).toBe(
						value.trim().toLocaleLowerCase(),
					)
				}
		}
	})

	it('keeps every prefix rule at least two characters long so the prefix index can find it', () => {
		for (const entry of KNOWN_APP_ALIASES)
			for (const clause of clauses(entry))
				if (
					'nameStartsWith' in clause ||
					'productNameStartsWith' in clause
				)
					for (const value of clauseValues(clause))
						expect(
							value.length,
							`${entry.id}: ${value}`,
						).toBeGreaterThanOrEqual(2)
	})

	it('lists each alias once per entry', () => {
		for (const entry of KNOWN_APP_ALIASES) {
			const values = entry.aliases.map(([value]) => value)
			expect(new Set(values).size, entry.id).toBe(values.length)
		}
	})

	it('stores no keyboard-layout or transliteration twin of another alias', () => {
		const twins: string[] = []
		for (const entry of KNOWN_APP_ALIASES) {
			const values = entry.aliases.map(([value]) => value)
			for (const value of values)
				for (const twin of queryTokenVariants(value).slice(1))
					if (values.includes(twin))
						twins.push(`${entry.id}: ${value} -> ${twin}`)
		}
		expect(twins).toEqual([])
	})

	it('carries no semantic, format or vendor word as an alias', () => {
		const offenders: string[] = []
		for (const entry of KNOWN_APP_ALIASES)
			for (const [value] of entry.aliases)
				if (FORBIDDEN_ALIASES.has(value))
					offenders.push(`${entry.id}: ${value}`)
		expect(offenders).toEqual([])
	})
})

describe('dictionary identity rules', () => {
	it('backs every strong alias with a clause that can yield a strong match', () => {
		const offenders: string[] = []
		for (const entry of KNOWN_APP_ALIASES) {
			const hasStrongAlias = entry.aliases.some(
				([, confidence]) => confidence === 'strong',
			)
			const hasStrongClause = entry.match.anyOf.some(
				clause => clauseStrengthCeiling(clause) === 'strong',
			)
			if (hasStrongAlias && !hasStrongClause) offenders.push(entry.id)
		}
		expect(offenders).toEqual([])
	})

	it('never lets a publisher, an original file name or a bare prefix be the whole identity', () => {
		const offenders: string[] = []
		for (const entry of KNOWN_APP_ALIASES)
			for (const clause of entry.match.anyOf)
				if (clauseStrengthCeiling(clause) === 'none')
					offenders.push(`${entry.id}: ${JSON.stringify(clause)}`)
		expect(offenders).toEqual([])
	})

	it('uses a supporting clause only inside an allOf with an identity clause', () => {
		const offenders: string[] = []
		for (const entry of KNOWN_APP_ALIASES)
			for (const clause of entry.match.anyOf) {
				if (
					'publisherContains' in clause ||
					'originalFilename' in clause
				)
					offenders.push(entry.id)
				if ('allOf' in clause) {
					const identity = clause.allOf.some(
						member =>
							!('publisherContains' in member) &&
							!('originalFilename' in member),
					)
					if (!identity) offenders.push(entry.id)
				}
			}
		expect(offenders).toEqual([])
	})
})

describe('alias collisions', () => {
	const owners = aliasOwners()

	it('never gives one strong alias to two entries', () => {
		const offenders: string[] = []
		for (const [value, list] of owners) {
			const strong = list.filter(owner => owner.confidence === 'strong')
			if (strong.length > 1)
				offenders.push(
					`${value}: ${strong.map(owner => owner.id).join(', ')}`,
				)
		}
		expect(offenders).toEqual([])
	})

	it('allows a normal or weak collision only through the explicit allowlist', () => {
		const offenders: string[] = []
		for (const [value, list] of owners) {
			if (list.length < 2) continue
			const allowed = KNOWN_ALIAS_COLLISIONS[value]
			const actual = list.map(owner => owner.id).sort()
			if (
				!allowed ||
				[...allowed.entries].sort().join() !== actual.join()
			)
				offenders.push(`${value}: ${actual.join(', ')}`)
		}
		expect(offenders).toEqual([])
	})

	it('keeps the allowlist free of stale entries', () => {
		for (const [value, { entries }] of Object.entries(
			KNOWN_ALIAS_COLLISIONS,
		)) {
			const actual = (owners.get(value) ?? [])
				.map(owner => owner.id)
				.sort()
			expect(actual, value).toEqual([...entries].sort())
			expect(
				(owners.get(value) ?? []).filter(
					owner => owner.confidence === 'strong',
				).length,
				value,
			).toBeLessThanOrEqual(1)
		}
	})

	it('reserves cmd for Command Prompt and never gives it to Windows Terminal', () => {
		expect(owners.get('cmd')).toEqual([
			{ id: 'command-prompt', confidence: 'strong' },
		])
	})
})

describe('short aliases', () => {
	it('has a golden query for every alias of three characters or fewer', () => {
		const covered = new Set(ALIAS_GOLDEN_QUERIES.map(entry => entry.query))
		const missing: string[] = []
		for (const entry of KNOWN_APP_ALIASES)
			for (const [value] of entry.aliases)
				if ([...value].length <= 3 && !covered.has(value))
					missing.push(`${entry.id}: ${value}`)
		expect(missing).toEqual([])
	})

	it('rates a two-character alias at most normal', () => {
		const offenders: string[] = []
		for (const entry of KNOWN_APP_ALIASES)
			for (const [value, confidence] of entry.aliases)
				if ([...value].length <= 2 && rank[confidence] === rank.strong)
					offenders.push(`${entry.id}: ${value}`)
		expect(offenders).toEqual(['windows-terminal: wt', 'ea-app: ea'])
	})
})
