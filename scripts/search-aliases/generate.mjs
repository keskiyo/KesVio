// Builds the known-package alias index shipped inside KesVio from a pinned winget-pkgs snapshot.
//
//   npm run aliases:update-source   -- download and pin a snapshot (writes the lock file)
//   npm run aliases:generate        -- this script: snapshot → generated index + report + quarantine
//   npm run aliases:audit           -- collision / size / diff / suspicious report over the index
//
// Everything runs on the developer machine. The application never talks to the network for
// aliases; it ships the generated file and reads it locally.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { encodeIndex, wrapperModule } from './lib/encode.mjs'
import {
	CANDIDATE_PRIORITY,
	GENERATOR_VERSION,
	MAX_ALIASES_PER_RECORD,
	confidenceFor,
	curatedAliasValues,
	forbiddenReason,
	isSafeSoloExternalName,
	versionlessName,
} from './lib/policy.mjs'
import { endsWithHelperWord } from '../../src/entities/app/lib/search/helperRecords.ts'
import { mergeVariants, packageRecord } from './lib/records.mjs'
import { LOCK_PATH, snapshotRoot, readLock } from './lib/snapshot.mjs'
import { WingetSource } from './lib/wingetSource.mjs'

const REPO = process.cwd()
const DATA_DIR = join(REPO, 'data', 'search-aliases')
const GENERATED_DIR = join(
	REPO,
	'src',
	'entities',
	'app',
	'lib',
	'search',
	'generated',
)
const OUTPUT_DATA = join(GENERATED_DIR, 'knownPackages.json')
const OUTPUT_MODULE = join(GENERATED_DIR, 'knownPackages.ts')
const REPORT = join(DATA_DIR, 'report.json')
const QUARANTINE = join(DATA_DIR, 'quarantine.json')
const PROVENANCE = join(DATA_DIR, 'provenance.json')
const EXPECTED_SOURCE = 'microsoft/winget-pkgs'

function countOwners(packages) {
	const nameOwners = new Map()
	const aliasOwners = new Map()
	for (const record of packages) {
		for (const name of record.names)
			nameOwners.set(name, (nameOwners.get(name) ?? 0) + 1)
		for (const value of record.candidates.keys())
			aliasOwners.set(value, (aliasOwners.get(value) ?? 0) + 1)
	}
	return { nameOwners, aliasOwners }
}

function dropReason(value, kind, collisions, curated) {
	const forbidden = forbiddenReason(value, kind)
	if (forbidden) return { reason: forbidden }
	if (curated.strong.has(value)) return { reason: 'curated_strong' }
	if (curated.any.has(value)) return { reason: 'curated_owned' }
	if (kind !== 'name' && curated.names.has(value))
		return { reason: 'curated_name' }
	const confidence = confidenceFor(value, collisions, kind)
	if (confidence) return { confidence }
	return {
		reason:
			[...value].length === 3 ? 'three_char_collision' : 'high_collision',
	}
}

function identityKinds(record) {
	const kinds = []
	if (record.families.length > 0) kinds.push('packageFamily')
	if (record.publishers.length > 0 && record.executables.length > 0)
		kinds.push('executable+publisher')
	if (record.publishers.length > 0 && record.names.length > 0)
		kinds.push('name+publisher')
	if (record.soloNames.length > 0) kinds.push('soloName')
	return kinds
}

export function runtimeRecords(packages, curated) {
	const { nameOwners, aliasOwners } = countOwners(packages)
	const quarantine = []
	const provenance = []
	const dropped = {
		too_short: 0,
		semantic: 0,
		generic: 0,
		host: 0,
		generic_command: 0,
		helper_command: 0,
		no_letters: 0,
		invalid_characters: 0,
		curated_strong: 0,
		curated_owned: 0,
		curated_name: 0,
		high_collision: 0,
		three_char_collision: 0,
		equals_identity_name: 0,
		over_limit: 0,
	}
	const stats = {
		normal: 0,
		weak: 0,
		withMoniker: 0,
		withCommands: 0,
		prunedNameOnly: 0,
		noIdentity: 0,
		helperPackages: 0,
		byKind: { moniker: 0, portable: 0, command: 0, name: 0, derived: 0 },
		identity: {
			packageFamily: 0,
			'executable+publisher': 0,
			'name+publisher': 0,
			soloName: 0,
			soloNameOnly: 0,
		},
		aliasesPerRecord: {},
	}
	const records = []
	for (const record of packages) {
		if (endsWithHelperWord(record.displayName)) {
			stats.helperPackages += 1
			continue
		}
		if (record.hasMoniker) stats.withMoniker += 1
		if (record.hasCommands) stats.withCommands += 1
		const publisherKey = record.publishers[0] ?? ''
		const soloNames = record.names.filter(name =>
			isSafeSoloExternalName(name, {
				owners: nameOwners,
				curatedNames: curated.names,
				publisherKey,
			}),
		)
		const identityNames = new Set(
			record.names.length === 1 ? record.names : [],
		)
		const accepted = []
		for (const [value, kind] of record.candidates) {
			const collisions = aliasOwners.get(value) ?? 1
			if (identityNames.has(value)) {
				dropped.equals_identity_name += 1
				continue
			}
			const { reason, confidence } = dropReason(
				value,
				kind,
				collisions,
				curated,
			)
			if (reason) {
				dropped[reason] += 1
				if (reason !== 'too_short' && reason !== 'no_letters')
					quarantine.push([
						value,
						record.identifier,
						reason,
						collisions,
					])
				continue
			}
			accepted.push({ value, kind, confidence, collisions })
		}
		accepted.sort(
			(left, right) =>
				CANDIDATE_PRIORITY[left.kind] -
					CANDIDATE_PRIORITY[right.kind] ||
				(left.confidence === right.confidence
					? 0
					: left.confidence === 'normal'
						? -1
						: 1),
		)
		const kept = accepted.slice(0, MAX_ALIASES_PER_RECORD)
		for (const extra of accepted.slice(MAX_ALIASES_PER_RECORD)) {
			dropped.over_limit += 1
			quarantine.push([
				extra.value,
				record.identifier,
				'over_limit',
				extra.collisions,
			])
		}
		const corroborated =
			record.families.length > 0 ||
			(record.publishers.length > 0 &&
				(record.executables.length > 0 || record.names.length > 0))
		if (!corroborated && soloNames.length === 0) {
			stats.noIdentity += 1
			continue
		}
		if (kept.length === 0) {
			stats.prunedNameOnly += 1
			continue
		}
		const aliases = kept.map(({ value, confidence }) => [value, confidence])
		for (const { value, kind, confidence } of kept) {
			stats[confidence] += 1
			stats.byKind[kind] += 1
			provenance.push([value, record.identifier, kind, confidence])
		}
		const runtime = { ...record, soloNames, aliases }
		const kinds = identityKinds(runtime)
		for (const kind of kinds) stats.identity[kind] += 1
		if (kinds.length === 1 && kinds[0] === 'soloName')
			stats.identity.soloNameOnly += 1
		stats.aliasesPerRecord[kept.length] =
			(stats.aliasesPerRecord[kept.length] ?? 0) + 1
		records.push(runtime)
	}
	const byValue = (left, right) =>
		left[0] < right[0]
			? -1
			: left[0] > right[0]
				? 1
				: left[1] < right[1]
					? -1
					: 1
	quarantine.sort(byValue)
	provenance.sort(byValue)
	return { records, quarantine, provenance, dropped, stats, aliasOwners }
}

function collisionSummary(aliasOwners) {
	const buckets = {
		unique: 0,
		two: 0,
		threeToFive: 0,
		moreThanFive: 0,
		moreThanTwenty: 0,
	}
	const top = []
	for (const [value, count] of aliasOwners) {
		if (count === 1) buckets.unique += 1
		else if (count === 2) buckets.two += 1
		else if (count <= 5) buckets.threeToFive += 1
		else {
			buckets.moreThanFive += 1
			if (count > 20) buckets.moreThanTwenty += 1
		}
		if (count > 5) top.push([value, count])
	}
	top.sort(
		(left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1),
	)
	return { buckets, top: top.slice(0, 40) }
}

export function buildIndex(items, lock, curated) {
	const variants = items.map(packageRecord)
	variants.sort((left, right) =>
		left.identifier < right.identifier ? -1 : 1,
	)
	const packages = mergeVariants(variants)
	const outcome = runtimeRecords(packages, curated)
	const { body, stringCount } = encodeIndex(outcome.records, lock)
	const collisions = collisionSummary(outcome.aliasOwners)
	const { records, quarantine, provenance, dropped, stats } = outcome
	const report = {
		source: lock.source,
		commit: lock.commit,
		generator: GENERATOR_VERSION,
		sourcePackages: variants.length,
		mergedPackages: packages.length,
		runtimeRecords: records.length,
		packagesWithMoniker: stats.withMoniker,
		packagesWithCommands: stats.withCommands,
		packagesWithoutIdentity: stats.noIdentity,
		packagesPrunedNameOnly: stats.prunedNameOnly,
		packagesPrunedHelper: stats.helperPackages,
		identity: stats.identity,
		aliasesEmitted: stats.normal + stats.weak,
		normalAliases: stats.normal,
		weakAliases: stats.weak,
		aliasesByKind: stats.byKind,
		aliasesPerRecord: stats.aliasesPerRecord,
		uniqueAliasValues: new Set(
			records.flatMap(record => record.aliases.map(([value]) => value)),
		).size,
		dropped,
		quarantined: quarantine.length,
		collisions: collisions.buckets,
		topCollisions: collisions.top,
		sizes: {
			generatedBytes: Buffer.byteLength(body),
			generatedGzipBytes: gzipSync(Buffer.from(body)).length,
			strings: stringCount,
		},
	}
	return { body, report, quarantine, provenance }
}

function main() {
	const lock = readLock()
	if (!lock)
		throw new Error(
			`no lock at ${LOCK_PATH}; run npm run aliases:update-source`,
		)
	const root = snapshotRoot(lock)
	if (!existsSync(root))
		throw new Error(
			`snapshot not found at ${root}; run npm run aliases:update-source`,
		)
	const source = new WingetSource(root)
	const items = [...source.load()]
	const { body, report, quarantine, provenance } = buildIndex(
		items,
		lock,
		curatedAliasValues(),
	)
	report.parseFailures = source.failures.length
	report.parseFailureSamples = source.failures.slice(0, 20)
	mkdirSync(GENERATED_DIR, { recursive: true })
	writeFileSync(OUTPUT_DATA, body + '\n')
	writeFileSync(OUTPUT_MODULE, wrapperModule(lock))
	mkdirSync(DATA_DIR, { recursive: true })
	writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n')
	writeFileSync(
		QUARANTINE,
		JSON.stringify({
			columns: ['alias', 'package', 'reason', 'collisions'],
			rows: quarantine,
		}) + '\n',
	)
	writeFileSync(
		PROVENANCE,
		JSON.stringify({
			columns: ['alias', 'package', 'kind', 'confidence'],
			rows: provenance,
		}) + '\n',
	)
	console.log(JSON.stringify(report, null, 2))
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
	main()
