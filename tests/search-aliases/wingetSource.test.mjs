import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	WingetSource,
	collectInstallerFacts,
	compareVersions,
	list,
	packageFacts,
	parseManifest,
	text,
} from '../../scripts/search-aliases/lib/wingetSource.mjs'

const FIXTURES = join(
	process.cwd(),
	'tests',
	'search-aliases',
	'fixtures',
	'manifests',
)

describe('parseManifest', () => {
	it('reads quoted escapes, anchors, flow sequences, block scalars, unicode and comments', () => {
		const doc = parseManifest(`# comment
Publisher: &pub "Weird \\"Corp\\" Ltd."
Author: *pub
PackageName: 'It''s ✨'
Tags: [a, "b c", d]
Folded: >-
  one
  two
Literal: |
  x
  y
Empty:
Flag: true
Number: 12
Nested:
    deep:
       - RelativeFilePath: a\\b.exe
         PortableCommandAlias: ab
`)
		expect(doc.Publisher).toBe('Weird "Corp" Ltd.')
		expect(doc.Author).toBe('Weird "Corp" Ltd.')
		expect(doc.PackageName).toBe("It's ✨")
		expect(doc.Tags).toEqual(['a', 'b c', 'd'])
		expect(doc.Folded).toBe('one two')
		expect(doc.Literal).toBe('x\ny\n')
		expect(doc.Empty).toBeNull()
		expect(doc.Flag).toBe(true)
		expect(doc.Number).toBe(12)
		expect(doc.Nested.deep[0].PortableCommandAlias).toBe('ab')
	})

	it('never pollutes prototypes and never evaluates tags', () => {
		const doc = parseManifest('__proto__:\n  polluted: true\nsafe: 1\n')
		expect({}.polluted).toBeUndefined()
		expect(Object.getPrototypeOf(doc)).toBe(Object.prototype)
		expect(doc.safe).toBe(1)
		const tagged = parseManifest('a: !!js/function "function(){}"')
		expect(typeof tagged.a).not.toBe('function')
	})
})

describe('field readers', () => {
	it('accept only strings, trim them and bound their length', () => {
		expect(text('  x  ')).toBe('x')
		expect(text(12)).toBe('')
		expect(text(null)).toBe('')
		expect(text('a'.repeat(300))).toBe('')
		expect(list(null)).toEqual([])
		expect(list('one')).toEqual(['one'])
		expect(list(['a', 1, null, ' b '])).toEqual(['a', 'b'])
	})
})

describe('compareVersions', () => {
	it('orders numerically per segment and falls back to text', () => {
		expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
		expect(compareVersions('2.0', '2.0.1')).toBeLessThan(0)
		expect(compareVersions('26.03', '26.03')).toBe(0)
		expect(compareVersions('1.0-beta', '1.0-alpha')).toBeGreaterThan(0)
	})
})

describe('collectInstallerFacts', () => {
	it('collects commands, portable aliases, executables, families and Apps & Features entries across installers', () => {
		const facts = collectInstallerFacts({
			Commands: ['top'],
			Installers: [
				{
					Commands: ['inner'],
					PackageFamilyName: 'Vendor.App_abc',
					NestedInstallerFiles: [
						{
							RelativeFilePath: 'bin\\tool.exe',
							PortableCommandAlias: 'tool',
						},
						{ RelativeFilePath: 'docs/readme.txt' },
					],
					AppsAndFeaturesEntries: [
						{ DisplayName: 'Tool (x64)', Publisher: 'Vendor Ltd' },
						{ DisplayName: null },
					],
				},
			],
		})
		expect(facts).toEqual({
			commands: ['top', 'inner'],
			portableAliases: ['tool'],
			families: ['Vendor.App_abc'],
			executables: ['tool.exe'],
			displayNames: ['Tool (x64)'],
			publishers: ['Vendor Ltd'],
		})
	})

	it('tolerates null commands and non-object installers', () => {
		expect(
			collectInstallerFacts({ Commands: null, Installers: ['x', null] })
				.commands,
		).toEqual([])
	})
})

describe('WingetSource over the fixture corpus', () => {
	const packages = [...new WingetSource(FIXTURES).load()]
	const byId = new Map(packages.map(item => [item.identifier, item]))

	it('walks every package once and selects its newest version', () => {
		expect(packages.length).toBe(33)
		expect(byId.get('Microsoft.VisualStudioCode').version).toBe('1.138.0')
		expect(byId.get('OpenJS.NodeJS.22').version).toBe('22.23.2')
		expect(new WingetSource(FIXTURES).failures).toEqual([])
	})

	it('merges localized names, Apps & Features display names and publishers into the package facts', () => {
		const firefox = byId.get('Mozilla.Firefox')
		expect(firefox.name).toBe('Mozilla Firefox (en-US)')
		expect(firefox.localizedNames).toEqual([])
		expect(byId.get('Google.Chrome.Beta').localizedNames).toEqual([
			'Google Chrome Beta',
			'Google Chrome 测试版',
		])
		expect(byId.get('Adobe.Acrobat.Reader.64-bit').displayNames).toEqual([
			'Adobe Acrobat (64-bit)',
		])
		expect(byId.get('DWANGO.SeirenVoice.yukari.Trial').publishers).toEqual([
			'DWANGO Co., Ltd.',
		])
	})

	it('extracts PackageFamilyName, NestedInstallerFiles and PortableCommandAlias', () => {
		expect(byId.get('Microsoft.WindowsTerminal').families).toEqual([
			'Microsoft.WindowsTerminal_8wekyb3d8bbwe',
		])
		const op = byId.get('AgileBits.1Password.CLI')
		expect(op.executables).toEqual(['op.exe'])
		expect(op.portableAliases).toEqual(['op'])
		expect(byId.get('Kubernetes.kubectl').commands).toEqual(['kubectl'])
	})

	it('survives awkward YAML and reads the singleton fixtures', () => {
		const weird = byId.get('WeirdCorp.Tool')
		expect(weird.name).toBe("Weird 'Quote' Tool ✨")
		expect(weird.publisher).toBe('Weird Corp "International" Ltd.')
		expect(weird.moniker).toBe('weirdtool')
		expect(weird.commands).toEqual([
			'wtool',
			'wt-run',
			'run',
			'open',
			'/verysilent',
			'a b',
			'weird',
			'weird-cli',
		])
		expect(weird.portableAliases).toEqual(['wtool'])
		expect(weird.executables).toEqual(['weird-tool.exe', 'helper.exe'])
		expect(weird.families).toEqual(['WeirdCorp.Tool_abcdef123456'])
		expect(weird.displayNames).toEqual(['Weird Tool (x64)'])
		expect(byId.get('Vendor.Product.7').name).toBe('Product 7')
	})

	it('builds facts from a singleton manifest', () => {
		const facts = packageFacts('X.Y', '1.0', {
			locale: { PackageName: 'Y', Publisher: 'X', Moniker: 'y' },
			locales: [{ PackageName: 'Ypsilon' }],
			installer: { Commands: ['y'] },
		})
		expect(facts).toMatchObject({
			name: 'Y',
			publisher: 'X',
			moniker: 'y',
			localizedNames: ['Ypsilon'],
			commands: ['y'],
		})
	})
})
