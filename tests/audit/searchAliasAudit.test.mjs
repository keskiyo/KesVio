import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appMatchFacts } from '../../src/entities/app/lib/search/knownAliasMatch'
import {
	matchedKnownEntries,
	resolveSearchAliases,
} from '../../src/entities/app/lib/search/resolveSearchAliases'

// Developer-only audit of the alias resolver against a real catalog. Not part of the regular
// suite: it runs only when KESVIO_ALIAS_AUDIT points at an apps-cache.json, e.g.
//   $env:KESVIO_ALIAS_AUDIT="$env:APPDATA\keskiyo.kesvio\apps-cache.json"
//   npx vitest run tests/audit/searchAliasAudit.test.ts
// and writes .1localDocuments/perf/alias-audit-<stamp>.json plus a console summary. Paths and
// names from the cache stay on this machine; nothing is asserted about the user's software.
const cachePath = process.env['KESVIO_ALIAS_AUDIT']

function suspicionsFor(app, entries, aliases) {
	const flags = []
	if (aliases.length > 10) flags.push('more than 10 aliases')
	if (entries.length > 1) flags.push('several dictionary entries matched')
	const strong = aliases.filter(alias => alias.confidence === 'strong')
	if (
		strong.length > 1 &&
		entries.length > 1 &&
		new Set(entries.map(entry => entry.split(':')[0])).size > 1
	)
		flags.push('strong aliases from different entries')
	if (
		entries.some(entry => entry.endsWith(':normal')) &&
		!entries.some(entry => entry.endsWith(':strong'))
	)
		flags.push('name-level identity only')
	const facts = appMatchFacts(app)
	if (
		facts.originalFilename &&
		aliases.some(alias => `${alias.value}.exe` === facts.originalFilename)
	)
		flags.push(
			'alias equals the original file name of a possibly hosted record',
		)
	if (
		aliases.some(
			alias => [...alias.value].length <= 3 && !alias.value.includes(' '),
		)
	)
		flags.push('short alias')
	return flags
}

describe.skipIf(!cachePath)('search alias audit of a live catalog', () => {
	it('writes the audit report', () => {
		const document = JSON.parse(readFileSync(cachePath, 'utf8'))
		const rows = document.apps.map(app => {
			const entries = matchedKnownEntries(app).map(
				match => `${match.entry.id}:${match.strength}`,
			)
			const aliases = resolveSearchAliases(app)
			return {
				name: app.name,
				path: app.path,
				visibility: app.visibilityClass ?? 'primary',
				entries,
				aliases: aliases.map(
					alias => `${alias.value} (${alias.confidence})`,
				),
				suspicious: suspicionsFor(app, entries, aliases),
			}
		})
		const summary = {
			records: rows.length,
			withDictionaryEntry: rows.filter(row => row.entries.length > 0)
				.length,
			withStrongEntry: rows.filter(row =>
				row.entries.some(entry => entry.endsWith(':strong')),
			).length,
			suspicious: rows.filter(row => row.suspicious.length > 0).length,
		}
		const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
		const folder = join(process.cwd(), '.1localDocuments', 'perf')
		mkdirSync(folder, { recursive: true })
		const target = join(folder, `alias-audit-${stamp}.json`)
		writeFileSync(target, JSON.stringify({ summary, rows }, null, 2))
		console.log(JSON.stringify({ target, summary }, null, 2))
		for (const row of rows.filter(row => row.suspicious.length > 0))
			console.log(
				`${row.name} [${row.visibility}] ${row.entries.join(', ') || '-'} → ${row.aliases.join(', ')} :: ${row.suspicious.join('; ')}`,
			)
		expect(rows.length).toBeGreaterThan(0)
	})
})
