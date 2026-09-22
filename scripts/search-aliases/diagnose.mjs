// Developer-only search triage. Nothing here runs in the application and nothing is recorded:
// the developer types the query or the app by hand.
//
//   npm run aliases:diagnose -- "vscode"              why does this query rank what it ranks
//   npm run aliases:diagnose -- --app "Wub"           why does this record carry these aliases
//   npm run aliases:diagnose -- --catalog <apps-cache.json> "query"
//
// The catalog defaults to KESVIO_ALIAS_AUDIT or %APPDATA%\keskiyo.kesvio\apps-cache.json.
// Every no-match ends with a gap class from docs/search-aliases.md ("Search gap triage").
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rankAppsByQuery } from '../../src/entities/app/lib/catalogSearch.ts'
import { KNOWN_APP_ALIASES } from '../../src/entities/app/lib/search/knownAppAliases.ts'
import { matchedKnownEntries } from '../../src/entities/app/lib/search/resolveSearchAliases.ts'
import {
	describeApp,
	explainMatch,
	installShippedIndex,
	queryTokens,
} from './lib/explain.mjs'

const DATA_DIR = join(process.cwd(), 'data', 'search-aliases')
const TOP = 8

function readRows(name) {
	const file = join(DATA_DIR, name)
	return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).rows : []
}

function loadCatalog(path) {
	const file =
		path ??
		process.env.KESVIO_ALIAS_AUDIT ??
		join(process.env.APPDATA ?? '', 'keskiyo.kesvio', 'apps-cache.json')
	if (!existsSync(file)) throw new Error(`no catalog at ${file}`)
	return JSON.parse(readFileSync(file, 'utf8')).apps
}

function printApp(app) {
	const info = describeApp(app)
	console.log(
		`App:\n  name: ${app.name}\n  productName: ${app.productName ?? ''}\n  publisher: ${app.publisher ?? ''}\n  executable: ${info.facts.pathExecutable ?? ''}\n  originalFilename: ${info.facts.originalFilename ?? ''}\n  packageFamily: ${info.facts.packageFamily ?? ''}\n  steamAppId: ${info.facts.steamAppId ?? ''}`,
	)
	console.log(
		`Generated:\n  ${info.generated.map(alias => `${alias.value} (${alias.confidence})`).join(', ') || '-'}`,
	)
	console.log('Curated matches:')
	for (const match of info.curated)
		console.log(
			`  ${match.entry} [${match.strength}] → ${match.aliases.map(([value, confidence]) => `${value} (${confidence})`).join(', ')}`,
		)
	if (info.curated.length === 0) console.log('  -')
	console.log('External matches:')
	for (const match of info.external)
		console.log(
			`  ${match.package} [${match.strength}] → ${match.aliases.map(([value, confidence]) => `${value} (${confidence})`).join(', ')}`,
		)
	if (info.external.length === 0) console.log('  -')
	console.log('Final aliases:')
	for (const alias of info.final)
		console.log(`  ${alias.value}  ${alias.confidence}  ${alias.source}`)
	if (info.final.length === 0) console.log('  -')
	console.log(`Helper: ${info.helper ? `yes — ${info.helper}` : 'no'}`)
}

function noMatchDiagnostics(query, tokens, apps, index) {
	const variants = [...new Set(tokens.flatMap(token => token.variants))]
	const phrase = tokens.map(token => token.value).join(' ')
	const wanted = new Set([...variants, phrase])
	const provenance = readRows('provenance.json').filter(([value]) =>
		wanted.has(value),
	)
	const quarantined = readRows('quarantine.json').filter(([value]) =>
		wanted.has(value),
	)
	const curated = KNOWN_APP_ALIASES.filter(entry =>
		entry.aliases.some(([value]) => wanted.has(value)),
	)
	const shipped = new Set(index.strings)
	console.log('NO MATCH')
	console.log(`Variants tried: ${variants.join(', ')}`)
	console.log(
		`Curated entries carrying the value: ${curated.map(entry => entry.id).join(', ') || 'none'}`,
	)
	for (const entry of curated) {
		const owners = apps.filter(app =>
			matchedKnownEntries(app).some(match => match.entry.id === entry.id),
		)
		console.log(
			`  ${entry.id} matched local apps: ${owners.map(app => app.name).join(', ') || 'none'}`,
		)
	}
	console.log(
		`External index carries the value: ${[...wanted].some(value => shipped.has(value)) ? 'yes' : 'no'}`,
	)
	for (const [value, id, kind, confidence] of provenance) {
		const owners = apps.filter(app =>
			matchedKnownEntries(app).some(
				match => match.entry.id === `winget:${id}`,
			),
		)
		console.log(
			`  ${value} ← ${id} (${kind}, ${confidence}); local apps matching that package: ${owners.map(app => app.name).join(', ') || 'none'}`,
		)
	}
	for (const [value, id, reason] of quarantined)
		console.log(`  quarantined: ${value} of ${id} — ${reason}`)
	const vetoed = apps.filter(app => {
		const info = describeApp(app)
		return (
			info.helper &&
			[
				app.name.toLocaleLowerCase(),
				...info.generated.map(alias => alias.value),
			].some(
				value =>
					wanted.has(value) ||
					[...wanted].some(needle => value.includes(needle)),
			)
		)
	})
	if (vetoed.length)
		console.log(
			`Helper-vetoed local apps resembling the query: ${vetoed.map(app => `${app.name} (${describeApp(app).helper})`).join(', ')}`,
		)
	let category =
		'EXPECTED_BEHAVIOR (generic or ambiguous query, or the software is not installed)'
	if (
		provenance.length &&
		provenance.every(
			([, id]) =>
				!apps.some(app =>
					matchedKnownEntries(app).some(
						match => match.entry.id === `winget:${id}`,
					),
				),
		)
	)
		category =
			'EXTERNAL_IDENTITY_FAILED if the software is installed (package and alias exist, no local record matched the package; run --app to see its facts), otherwise EXPECTED_BEHAVIOR (not installed)'
	else if (vetoed.length)
		category =
			'HELPER_FALSE_VETO? (a vetoed record resembles the query — verify it is a real product)'
	else if (quarantined.length && !provenance.length)
		category =
			'EXPECTED_BEHAVIOR (alias quarantined by policy) or MISSING_CURATED_ALIAS'
	else if (curated.length === 0 && provenance.length === 0)
		category =
			'MISSING_CURATED_ALIAS / EXTERNAL_PACKAGE_MISSING / GENERATED_ALIAS_MISSING — decide by whether the app is installed'
	console.log(`Likely class: ${category}`)
}

function printQuery(query, apps, index) {
	const tokens = queryTokens(query)
	console.log(`Query:\n  ${query}\nVariants:`)
	for (const token of tokens)
		console.log(`  ${token.value} → ${token.variants.join(' | ')}`)
	const ranked = rankAppsByQuery(apps, query)
	if (ranked.length === 0)
		return noMatchDiagnostics(query, tokens, apps, index)
	console.log(`Results (${ranked.length}):`)
	ranked.slice(0, TOP).forEach((app, position) => {
		const { score, perToken } = explainMatch(app, tokens)
		console.log(
			`${position + 1}. ${app.name}${app.publisher ? ` — ${app.publisher}` : ''}\n   total score: ${score}`,
		)
		for (const hit of perToken)
			console.log(
				`   ${hit.token}: ${hit.kind}${hit.alias ? ` alias = ${hit.alias} (${hit.confidence}, ${hit.source ?? 'generated'}${hit.entry ? `, ${hit.entry}` : ''})` : ''}${hit.variant ? `, variant = ${hit.variantKind} "${hit.variant}"` : ''}`,
			)
	})
	if (ranked.length > TOP) console.log(`… ${ranked.length - TOP} more`)
	console.log(
		'Note: the main catalog shows matches grouped by category (UI_SEARCH_PRESENTATION); Ctrl+K and the scenario picker use this global order.',
	)
}

function main() {
	const argv = process.argv.slice(2)
	const option = name => {
		const index = argv.indexOf(name)
		return index < 0 ? null : argv[index + 1]
	}
	const catalogPath = option('--catalog')
	const appQuery = option('--app')
	const query = argv
		.filter(
			(value, index) =>
				!value.startsWith('--') &&
				argv[index - 1] !== '--catalog' &&
				argv[index - 1] !== '--app',
		)
		.join(' ')
	const apps = loadCatalog(catalogPath)
	const index = installShippedIndex()
	if (appQuery) {
		const needle = appQuery.toLocaleLowerCase()
		const found = apps.filter(
			app =>
				app.id === appQuery ||
				app.name.toLocaleLowerCase() === needle ||
				app.name.toLocaleLowerCase().includes(needle),
		)
		if (found.length === 0) throw new Error(`no app matches ${appQuery}`)
		found.slice(0, 3).forEach((app, position) => {
			if (position > 0) console.log('')
			printApp(app)
		})
		return
	}
	if (!query)
		throw new Error('usage: aliases:diagnose -- "query" | --app "name"')
	printQuery(query, apps, index)
}

main()
