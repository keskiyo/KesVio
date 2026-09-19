import { beforeAll, describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { KNOWN_PACKAGE_INDEX } from '../../../../../src/entities/app/lib/search/generated/knownPackages'
import { KNOWN_APP_ALIASES } from '../../../../../src/entities/app/lib/search/knownAppAliases'
import { loadKnownPackageIndex } from '../../../../../src/entities/app/lib/search/knownPackageIndex'
import {
	matchedKnownEntries,
	resolveSearchAliases,
} from '../../../../../src/entities/app/lib/search/resolveSearchAliases'
import type { AppInfo } from '../../../../../src/entities/app'
import { app, shortcut } from './fixtures/app'

interface InventedApp {
	record: AppInfo
	queries: string[]
	forbidden: string[]
}

// Products that exist in neither dictionary. They keep the generated tier honest: name,
// versionless name, real executable, product name, vendor stripping and a safe acronym must be
// enough on their own, and nothing may leak in from a host or from a look-alike package.
const INVENTED: InventedApp[] = [
	{
		record: app({
			id: 'quillrock',
			name: 'Quillrock Notes Studio',
			path: String.raw`C:\Invented\Quillrock\qns.exe`,
			publisher: 'Quillrock Labs',
		}),
		queries: ['quillrock', 'qns', 'qns.exe', 'notes studio'],
		forbidden: ['notes', 'studio'],
	},
	{
		record: app({
			id: 'fennelworks',
			name: 'Fennelworks Ledger 3.4',
			path: String.raw`C:\Invented\Fennelworks\fwledger64.exe`,
			publisher: 'Fennelworks GmbH',
		}),
		queries: ['fennelworks ledger', 'fwledger', 'fwledger64', 'ledger'],
		forbidden: ['ledger 3.4'],
	},
	{
		record: app({
			id: 'tidewatch',
			name: 'Orbital Tidewatch',
			path: String.raw`C:\Invented\Orbital\tidewatch.exe`,
			productName: 'Tidewatch Pro',
			publisher: 'Orbital Systems',
		}),
		queries: ['tidewatch', 'tidewatch pro', 'orbital'],
		forbidden: ['pro'],
	},
	{
		record: shortcut({
			id: 'marrowbyte',
			name: 'Marrowbyte Sketch',
			originalFilename: 'electron.exe',
			productName: 'Electron',
			publisher: 'Marrowbyte',
		}),
		queries: ['marrowbyte', 'sketch'],
		forbidden: ['electron', 'electron.exe'],
	},
	{
		record: app({
			id: 'halcyon',
			name: 'Halcyon Vault Manager',
			path: String.raw`C:\Invented\Halcyon\hvault.exe`,
			publisher: 'Halcyon Software',
		}),
		queries: ['halcyon', 'hvault', 'vault manager'],
		forbidden: ['manager'],
	},
	{
		record: app({
			id: 'brindlecast',
			name: 'Brindlecast Radio Tower',
			path: String.raw`C:\Invented\Brindlecast\brt.exe`,
			publisher: 'Brindlecast Media',
		}),
		queries: ['brindlecast', 'brt', 'radio tower'],
		forbidden: ['radio', 'tower'],
	},
	{
		record: app({
			id: 'velvetgrid',
			name: 'Velvetgrid Photo Sorter 2024',
			path: String.raw`C:\Invented\Velvetgrid\velvetgrid.exe`,
			publisher: 'Velvetgrid Oy',
		}),
		queries: ['velvetgrid', 'velvetgrid photo sorter', 'photo sorter'],
		forbidden: ['photo'],
	},
	{
		record: app({
			id: 'kestrelpad',
			name: 'KestrelPad',
			path: String.raw`C:\Invented\KestrelPad\kestrelpad64.exe`,
			publisher: 'Kestrel Tools Ltd',
		}),
		queries: ['kestrelpad', 'kestrelpad64', 'kestrel'],
		forbidden: ['pad'],
	},
	{
		record: app({
			id: 'sablemoor',
			name: 'Sablemoor Deck Builder',
			path: String.raw`C:\Program Files\Python312\pythonw.exe`,
			productName: 'Python',
			publisher: 'Python Software Foundation',
		}),
		queries: ['sablemoor', 'deck builder'],
		forbidden: ['python', 'pythonw', 'python312'],
	},
	{
		record: app({
			id: 'thistlecore',
			name: 'Thistlecore Archive Explorer',
			path: String.raw`C:\Invented\Thistlecore\tcarchive.exe`,
			publisher: 'Thistlecore',
		}),
		queries: ['thistlecore', 'tcarchive', 'archive explorer', 'tae'],
		forbidden: ['archive', 'explorer'],
	},
]

describe('software unknown to both dictionaries', () => {
	beforeAll(async () => {
		await loadKnownPackageIndex()
	})

	it('is genuinely absent from the curated dictionary and the external corpus', () => {
		const shipped = new Set(KNOWN_PACKAGE_INDEX.strings)
		const curated = new Set(
			KNOWN_APP_ALIASES.flatMap(entry =>
				entry.aliases.map(([value]) => value),
			),
		)
		for (const { record } of INVENTED) {
			const name = record.name.toLocaleLowerCase()
			expect(shipped.has(name), name).toBe(false)
			expect(curated.has(name), name).toBe(false)
			expect(
				matchedKnownEntries(record).map(match => match.entry.id),
				name,
			).toEqual([])
		}
	})

	it.each(INVENTED.map(entry => [entry.record.name, entry]))(
		'%s is found through its own record and borrows nothing',
		(_name, { record, queries, forbidden }) => {
			const catalog = INVENTED.map(entry => entry.record)
			for (const query of queries)
				expect(
					rankAppsByQuery(catalog, query)[0]?.id,
					`query ${query}`,
				).toBe(record.id)
			const aliases = resolveSearchAliases(record).map(
				alias => alias.value,
			)
			for (const value of forbidden)
				expect(aliases, `alias ${value}`).not.toContain(value)
			expect(
				resolveSearchAliases(record).some(
					alias => alias.confidence === 'strong',
				),
			).toBe(false)
		},
	)
})
