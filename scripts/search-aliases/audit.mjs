// Reads the generated known-package index and prints the size, collision, suspicious-alias and
// diff report a reviewer needs before accepting a regenerated corpus.
//
//   node scripts/search-aliases/audit.mjs                              -- size budget, collisions, suspicious
//   node scripts/search-aliases/audit.mjs --baseline <old knownPackages.json>   -- plus the diff section
//   node scripts/search-aliases/audit.mjs --show <part of PackageIdentifier>…  -- decoded records
//   node scripts/search-aliases/audit.mjs --explain <alias>…                    -- where an alias came from
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import {
	FORBIDDEN_ALIAS_VALUES,
	GENERIC_NAMES,
	GENERIC_WORDS,
} from '../../src/entities/app/lib/search/aliasPolicy.ts'

const REPO = process.cwd()
const DATA_DIR = join(REPO, 'data', 'search-aliases')
const GENERATED = join(
	REPO,
	'src',
	'entities',
	'app',
	'lib',
	'search',
	'generated',
	'knownPackages.json',
)
const REPORT = join(DATA_DIR, 'report.json')
const PROVENANCE = join(DATA_DIR, 'provenance.json')
const SIZE_BUDGET_GZIP = 1024 * 1024
const MAX_ALIASES_PER_RECORD = 10
const VERSION_LIKE = /\d+\.\d+|(?:^|[^a-z])v?\d{2,}$/
const ARCHITECTURE =
	/(?:^|[-_ .])(?:x64|x86|arm64|arm|win64|win32|amd64|ia32)(?:[-_ .]|$)/
const INSTALLER_TERM = /setup|install|updat|uninstall|portable|msi|msix/
const URL_LIKE = /:\/\/|www\.|<http|mailto:/
const CONSONANTS_ONLY = /^[bcdfghjklmnpqrstvwxz]+$/

function loadIndex(file) {
	const text = readFileSync(file, 'utf8')
	return { text, data: JSON.parse(text) }
}

function decode(data) {
	const string = index => data.strings[index]
	const map = new Map()
	for (const [
		id,
		names,
		soloNames,
		publishers,
		families,
		executables,
		aliases,
	] of data.records) {
		const list = []
		for (let index = 0; index + 1 < aliases.length; index += 2)
			list.push(
				`${string(aliases[index])}:${aliases[index + 1] === 1 ? 'weak' : 'normal'}`,
			)
		map.set(string(id), {
			names: names.map(string),
			soloNames: soloNames.map(string),
			publishers: publishers.map(string),
			families: families.map(string),
			executables: executables.map(string),
			aliases: list,
		})
	}
	return map
}

function aliasValueOf(alias) {
	return alias.slice(0, alias.lastIndexOf(':'))
}

function showRecords(current, wanted) {
	for (const [id, record] of current) {
		if (!wanted.some(value => id.toLowerCase().includes(value))) continue
		console.log(
			`${id}\n  names: ${record.names.join(' | ')}\n  solo: ${record.soloNames.join(' | ')}\n  publishers: ${record.publishers.join(' | ')}\n  families: ${record.families.join(' | ')}\n  exe: ${record.executables.join(' | ')}\n  aliases: ${record.aliases.join(', ')}`,
		)
	}
}

function explain(current, wanted) {
	const provenance = existsSync(PROVENANCE)
		? JSON.parse(readFileSync(PROVENANCE, 'utf8')).rows
		: []
	for (const alias of wanted) {
		const rows = provenance.filter(([value]) => value === alias)
		if (rows.length === 0) {
			console.log(`${alias}: not shipped by the external index`)
			continue
		}
		for (const [, id, kind, confidence] of rows) {
			const record = current.get(id)
			const evidence = []
			if (record?.families.length) evidence.push('packageFamily')
			if (record?.executables.length && record.publishers.length)
				evidence.push('executable+publisher')
			if (record?.names.length && record.publishers.length)
				evidence.push('name+publisher')
			if (record?.soloNames.length) evidence.push('soloName (weak)')
			console.log(
				`${alias}: source external, package ${id}, kind ${kind}, confidence ${confidence}, match evidence ${evidence.join(' / ') || 'none'}`,
			)
		}
	}
}

function suspiciousReport(current, aliasOwners) {
	const flags = new Map()
	const flag = (name, detail) => {
		const list = flags.get(name) ?? []
		list.push(detail)
		flags.set(name, list)
	}
	const provenance = existsSync(PROVENANCE)
		? new Map(
				JSON.parse(readFileSync(PROVENANCE, 'utf8')).rows.map(
					([value, id, kind]) => [`${value}@${id}`, kind],
				),
			)
		: new Map()
	for (const [id, record] of current) {
		if (record.aliases.length > MAX_ALIASES_PER_RECORD)
			flag('more than 10 aliases', `${id}: ${record.aliases.length}`)
		if (record.soloNames.length > 0 && record.names.length === 0)
			flag('soloName-only identity', id)
		for (const alias of record.aliases) {
			const value = aliasValueOf(alias)
			const weak = alias.endsWith(':weak')
			const owners = aliasOwners.get(value)?.length ?? 1
			if ([...value].length <= 3)
				flag('alias length <= 3', `${value} (${id})`)
			if (owners > 1 && !weak)
				flag('normal collision', `${value} (${id})`)
			if (owners > 1 && weak)
				flag('weak collision', `${value} ×${owners}`)
			if (record.publishers.includes(value))
				flag('alias equals publisher', `${value} (${id})`)
			if (
				GENERIC_WORDS.has(value) ||
				GENERIC_NAMES.has(value) ||
				FORBIDDEN_ALIAS_VALUES.has(value)
			)
				flag('generic dictionary word', `${value} (${id})`)
			if (VERSION_LIKE.test(value))
				flag('contains version', `${value} (${id})`)
			if (ARCHITECTURE.test(value))
				flag('contains architecture', `${value} (${id})`)
			if (INSTALLER_TERM.test(value))
				flag('installer terminology', `${value} (${id})`)
			if (URL_LIKE.test(value)) flag('url-like', `${value} (${id})`)
			if (/[\\/]/.test(value)) flag('path separator', `${value} (${id})`)
			if (CONSONANTS_ONLY.test(value) && value.length >= 4)
				flag('consonant-only abbreviation', `${value} (${id})`)
			if (provenance.get(`${value}@${id}`) === 'derived')
				flag('derived identifier token', `${value} (${id})`)
		}
	}
	console.log('suspicious aliases (review, not failures):')
	for (const [name, list] of [...flags].sort(
		(a, b) => b[1].length - a[1].length,
	)) {
		const unique = [...new Set(list)]
		console.log(
			`  ${name}: ${unique.length}${unique.length ? ` — ${unique.slice(0, 6).join(', ')}${unique.length > 6 ? ', …' : ''}` : ''}`,
		)
	}
}

function diffAgainst(current, baselinePath, raw, gzip) {
	const baselineIndex = loadIndex(baselinePath)
	const previous = decode(baselineIndex.data)
	const previousRaw = Buffer.byteLength(baselineIndex.text)
	const previousGzip = gzipSync(Buffer.from(baselineIndex.text)).length
	const added = [...current.keys()].filter(id => !previous.has(id))
	const removed = [...previous.keys()].filter(id => !current.has(id))
	let aliasesAdded = 0
	let aliasesRemoved = 0
	const changed = []
	for (const [id, record] of current) {
		const before = previous.get(id)
		if (!before) {
			aliasesAdded += record.aliases.length
			continue
		}
		const gained = record.aliases.filter(
			alias => !before.aliases.includes(alias),
		)
		const lost = before.aliases.filter(
			alias => !record.aliases.includes(alias),
		)
		aliasesAdded += gained.length
		aliasesRemoved += lost.length
		if (gained.length || lost.length)
			changed.push(`${id}: +[${gained.join(' ')}] -[${lost.join(' ')}]`)
	}
	for (const [id, record] of previous)
		if (!current.has(id)) aliasesRemoved += record.aliases.length
	const percent = (now, before) =>
		before === 0
			? 'n/a'
			: `${(((now - before) / before) * 100).toFixed(1)}%`
	console.log(
		`diff vs baseline: packages +${added.length} -${removed.length} (${current.size - previous.size >= 0 ? '+' : ''}${current.size - previous.size}), aliases +${aliasesAdded} -${aliasesRemoved}, changed records ${changed.length}`,
	)
	console.log(
		`size delta: raw ${raw - previousRaw >= 0 ? '+' : ''}${raw - previousRaw} B (${percent(raw, previousRaw)}), gzip ${gzip - previousGzip >= 0 ? '+' : ''}${gzip - previousGzip} B (${percent(gzip, previousGzip)})`,
	)
	for (const line of changed.slice(0, 60)) console.log(`  ${line}`)
}

function main() {
	const argv = process.argv.slice(2)
	const option = name => {
		const index = argv.indexOf(name)
		return index < 0 ? null : argv.slice(index + 1)
	}
	const { text, data } = loadIndex(GENERATED)
	const current = decode(data)
	const show = option('--show')
	if (show)
		return showRecords(
			current,
			show.map(value => value.toLowerCase()),
		)
	const explainValues = option('--explain')
	if (explainValues)
		return explain(
			current,
			explainValues.map(value => value.toLowerCase()),
		)
	const raw = Buffer.byteLength(text)
	const gzip = gzipSync(Buffer.from(text)).length
	const brotli = brotliCompressSync(Buffer.from(text)).length
	const aliasOwners = new Map()
	for (const [id, record] of current)
		for (const alias of record.aliases) {
			const value = aliasValueOf(alias)
			const owners = aliasOwners.get(value) ?? []
			owners.push(id)
			aliasOwners.set(value, owners)
		}
	const collisions = [...aliasOwners].filter(
		([, owners]) => owners.length > 1,
	)
	const report = existsSync(REPORT)
		? JSON.parse(readFileSync(REPORT, 'utf8'))
		: null
	console.log(
		`source: ${data.source}@${data.commit} generator v${data.generator}`,
	)
	console.log(`records: ${current.size}, strings: ${data.strings.length}`)
	console.log(
		`size: raw ${(raw / 1024).toFixed(0)} KiB, gzip ${(gzip / 1024).toFixed(0)} KiB, brotli ${(brotli / 1024).toFixed(0)} KiB (budget gzip ${SIZE_BUDGET_GZIP / 1024} KiB)`,
	)
	console.log(
		`aliases: ${[...current.values()].reduce((sum, record) => sum + record.aliases.length, 0)}, distinct ${aliasOwners.size}, shipped collisions ${collisions.length}`,
	)
	const worst = collisions
		.sort((left, right) => right[1].length - left[1].length)
		.slice(0, 15)
	for (const [value, owners] of worst)
		console.log(
			`  ${value}: ${owners.length} (${owners.slice(0, 4).join(', ')}${owners.length > 4 ? ', …' : ''})`,
		)
	if (report)
		console.log(
			`generator report: records ${report.runtimeRecords}, pruned name-only ${report.packagesPrunedNameOnly}, pruned helper ${report.packagesPrunedHelper}, identity ${JSON.stringify(report.identity)}, kinds ${JSON.stringify(report.aliasesByKind)}, quarantined ${report.quarantined}, dropped ${JSON.stringify(report.dropped)}`,
		)
	suspiciousReport(current, aliasOwners)
	if (gzip > SIZE_BUDGET_GZIP) {
		console.error(
			`SIZE BUDGET EXCEEDED: gzip ${gzip} > ${SIZE_BUDGET_GZIP}`,
		)
		process.exitCode = 1
	}
	const baseline = option('--baseline')
	if (baseline?.[0]) diffAgainst(current, baseline[0], raw, gzip)
}

main()
