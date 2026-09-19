import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeKnownPackageIndex } from '../../src/entities/app/lib/search/knownPackageIndex.ts'
import {
	encodeIndex,
	wrapperModule,
} from '../../scripts/search-aliases/lib/encode.mjs'
import { curatedAliasValues } from '../../scripts/search-aliases/lib/policy.mjs'
import { WingetSource } from '../../scripts/search-aliases/lib/wingetSource.mjs'
import { buildIndex } from '../../scripts/search-aliases/generate.mjs'

const FIXTURES = join(process.cwd(), 'tests', 'search-aliases', 'fixtures')
const EXPECTED = join(FIXTURES, 'expected-index.json')
const LOCK = {
	source: 'microsoft/winget-pkgs',
	commit: '0a5a7ba57e69adc0a8016154b5b1d7eaae82f916',
}

function generate() {
	const items = [...new WingetSource(join(FIXTURES, 'manifests')).load()]
	return buildIndex(items, LOCK, curatedAliasValues())
}

// The fixture corpus is small enough to regenerate on every run; the recorded output pins the
// generator's behaviour so a policy or parser change shows up as a reviewed diff rather than
// silently reshaping the 14 000-package index.
describe('generator over the fixture corpus', () => {
	const { body, report, quarantine, provenance } = generate()
	const index = JSON.parse(body)
	const entries = decodeKnownPackageIndex(index)
	const byId = new Map(entries.map(entry => [entry.id, entry]))

	it('produces deterministic output that matches the recorded fixture', () => {
		const again = generate()
		expect(again.body).toBe(body)
		expect(again.quarantine).toEqual(quarantine)
		const snapshot = JSON.stringify(
			{
				index,
				report: { ...report, sizes: undefined },
				quarantine,
				provenance,
			},
			null,
			1,
		)
		if (
			process.env.KESVIO_ALIAS_FIXTURE_UPDATE === '1' ||
			!existsSync(EXPECTED)
		)
			writeFileSync(EXPECTED, snapshot + '\n')
		expect(snapshot + '\n').toBe(readFileSync(EXPECTED, 'utf8'))
	})

	it('encodes a string table where every record index resolves and the header pins the source', () => {
		expect(index.version).toBe(1)
		expect(index.commit).toBe(LOCK.commit)
		expect(index.generator).toBe(2)
		expect(new Set(index.strings).size).toBe(index.strings.length)
		for (const record of index.records)
			for (const part of record)
				for (const value of Array.isArray(part) ? part : [part])
					expect(value).toBeLessThan(index.strings.length + 2)
		const { stringCount } = encodeIndex([], LOCK)
		expect(stringCount).toBe(0)
		expect(wrapperModule(LOCK)).toContain('GENERATED FILE')
		expect(wrapperModule(LOCK)).toContain(LOCK.commit)
	})

	it('collapses version families with evidence and keeps numeric product identity apart', () => {
		expect(byId.has('winget:OpenJS.NodeJS')).toBe(true)
		expect(byId.has('winget:OpenJS.NodeJS.22')).toBe(false)
		expect(byId.has('winget:Python.Python')).toBe(true)
		expect(byId.has('winget:Vendor.Product.7')).toBe(true)
		expect(byId.has('winget:Vendor.Product.8')).toBe(true)
		expect(byId.has('winget:Vendor.Studio')).toBe(true)
		expect(byId.has('winget:ArobasMusic.GuitarPro')).toBe(true)
		expect(byId.has('winget:ArobasMusic.GuitarPro.8')).toBe(false)
		expect(byId.has('winget:Mozilla.Firefox.ru')).toBe(false)
	})

	it('quarantines the dangerous candidates of the awkward fixture and keeps the safe ones', () => {
		const weird = byId.get('winget:WeirdCorp.Tool')
		expect(weird.aliases.map(([value]) => value)).toEqual(
			expect.arrayContaining([
				'weirdtool',
				'wtool',
				'wt-run',
				'weird-cli',
			]),
		)
		const reasons = new Map(
			quarantine
				.filter(([, id]) => id === 'WeirdCorp.Tool')
				.map(([value, , reason]) => [value, reason]),
		)
		expect(reasons.get('run')).toBe('generic')
		expect(reasons.get('open')).toBe('generic')
		expect(reasons.get('/verysilent')).toBe('invalid_characters')
		expect(reasons.get('a b')).toBeUndefined()
		expect(weird.match.anyOf[0]).toEqual({
			packageFamily: ['weirdcorp.tool_abcdef123456'],
		})
	})

	it('drops an alias equal to the only name a record has, keeps alternate name forms and caps ten per record', () => {
		for (const entry of entries) {
			expect(entry.aliases.length).toBeLessThanOrEqual(10)
			const names = new Set(entry.match.nameOnly ?? [])
			for (const clause of entry.match.anyOf)
				if ('allOf' in clause)
					for (const member of clause.allOf)
						if ('name' in member)
							member.name.forEach(value => names.add(value))
			if (names.size === 1)
				for (const [value] of entry.aliases)
					expect(names.has(value)).toBe(false)
		}
		expect(
			byId
				.get('winget:Adobe.Acrobat.Reader.64-bit')
				.aliases.map(([value]) => value),
		).toContain('acrobat reader')
		expect(
			byId
				.get('winget:Microsoft.WindowsTerminal')
				.aliases.map(([value]) => value),
		).toContain('windowsterminal')
		expect(byId.has('winget:Microsoft.EdgeWebView2Runtime')).toBe(true)
		expect(report.packagesPrunedHelper).toBe(0)
		expect(report.packagesPrunedNameOnly).toBeGreaterThan(0)
	})

	it('reports identity kinds, alias kinds and provenance for every shipped alias', () => {
		expect(report.identity.packageFamily).toBeGreaterThan(0)
		expect(report.identity['executable+publisher']).toBeGreaterThan(0)
		expect(report.identity['name+publisher']).toBeGreaterThan(0)
		expect(report.aliasesEmitted).toBe(provenance.length)
		const kubectl = provenance.find(
			([value, id]) => value === 'kubectl' && id === 'Kubernetes.kubectl',
		)
		expect(kubectl).toEqual([
			'kubectl',
			'Kubernetes.kubectl',
			'moniker',
			'normal',
		])
		expect(report.aliasesByKind.name).toBeGreaterThan(0)
	})
})
