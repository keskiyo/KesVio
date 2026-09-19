import { describe, expect, it } from 'vitest'
import {
	candidateAliases,
	canonicalIdentifier,
	derivedIdToken,
	isVersionFamilyMember,
	mergeVariants,
	nameForms,
	packageRecord,
} from '../../scripts/search-aliases/lib/records.mjs'

function item(overrides) {
	return {
		identifier: 'Vendor.Product',
		version: '1.0.0',
		name: 'Product',
		publisher: 'Vendor Inc.',
		moniker: '',
		localizedNames: [],
		commands: [],
		portableAliases: [],
		families: [],
		executables: [],
		displayNames: [],
		publishers: [],
		...overrides,
	}
}

describe('canonicalIdentifier', () => {
	it.each([
		['Mozilla.Firefox.en-US', 'Mozilla.Firefox'],
		['Mozilla.Firefox.ru', 'Mozilla.Firefox'],
		['Foo.Bar.MSI', 'Foo.Bar'],
		['Foo.Bar.Portable', 'Foo.Bar'],
		['Foo.Bar.x64', 'Foo.Bar'],
		['OpenJS.NodeJS.22', 'OpenJS.NodeJS'],
		['OpenJS.NodeJS.LTS', 'OpenJS.NodeJS'],
		['Python.Python.3.12', 'Python.Python'],
		['Microsoft.DotNet.SDK.3_1', 'Microsoft.DotNet.SDK'],
		['Google.Chrome.Beta', 'Google.Chrome.Beta'],
		['Mozilla.Firefox.ESR', 'Mozilla.Firefox.ESR'],
		['7zip.7zip', '7zip.7zip'],
		['Vendor.Product7', 'Vendor.Product7'],
	])('reduces %s to %s', (identifier, canonical) => {
		expect(canonicalIdentifier(identifier)).toBe(canonical)
	})
})

describe('isVersionFamilyMember', () => {
	it('accepts a numeric suffix when the manifest version agrees, even if the name carries it', () => {
		expect(
			isVersionFamilyMember(
				{
					identifier: 'OpenJS.NodeJS.22',
					version: '22.23.2',
					displayName: 'node.js',
				},
				0,
			),
		).toBe(true)
		expect(
			isVersionFamilyMember(
				{
					identifier: 'Python.Python.3.12',
					version: '3.12.10',
					displayName: 'python 3.12',
				},
				2,
			),
		).toBe(true)
	})

	it('accepts a numeric suffix on sibling evidence alone', () => {
		expect(
			isVersionFamilyMember(
				{
					identifier: 'Oracle.JDK.21',
					version: '21.0.9',
					displayName: 'java(tm) se development kit',
				},
				5,
			),
		).toBe(true)
		expect(
			isVersionFamilyMember(
				{
					identifier: 'Oracle.JDK.21',
					version: '9.9',
					displayName: 'java(tm) se development kit',
				},
				5,
			),
		).toBe(true)
	})

	it('rejects a numeric suffix that the display name carries when only siblings suggest a family', () => {
		expect(
			isVersionFamilyMember(
				{
					identifier: 'Vendor.Product.7',
					version: '2.0.0',
					displayName: 'product 7',
				},
				2,
			),
		).toBe(false)
		expect(
			isVersionFamilyMember(
				{
					identifier: 'ArobasMusic.GuitarPro.8',
					version: '1.5.0',
					displayName: 'guitar pro 8',
				},
				2,
			),
		).toBe(false)
	})

	it('rejects a lone numeric suffix without version agreement and treats LTS as a family only with siblings', () => {
		expect(
			isVersionFamilyMember(
				{
					identifier: 'Vendor.App.3',
					version: '1.2.0',
					displayName: 'app',
				},
				0,
			),
		).toBe(false)
		expect(
			isVersionFamilyMember(
				{
					identifier: 'OpenJS.NodeJS.LTS',
					version: '24.19.0',
					displayName: 'node.js',
				},
				0,
			),
		).toBe(false)
		expect(
			isVersionFamilyMember(
				{
					identifier: 'OpenJS.NodeJS.LTS',
					version: '24.19.0',
					displayName: 'node.js',
				},
				2,
			),
		).toBe(true)
	})
})

describe('mergeVariants', () => {
	it('merges Node.js 22 and 24 into one family without versioned forms', () => {
		const merged = mergeVariants([
			packageRecord(
				item({
					identifier: 'OpenJS.NodeJS.22',
					version: '22.23.2',
					name: 'Node.js',
					moniker: 'nodejs-22',
					commands: ['node', 'npm'],
				}),
			),
			packageRecord(
				item({
					identifier: 'OpenJS.NodeJS.24',
					version: '24.1.0',
					name: 'Node.js',
					moniker: 'nodejs-24',
					commands: ['node', 'corepack'],
				}),
			),
		])
		expect(merged.map(record => record.identifier)).toEqual([
			'OpenJS.NodeJS',
		])
		const keys = [...merged[0].candidates.keys()]
		expect(keys).toEqual(
			expect.arrayContaining(['node', 'npm', 'corepack']),
		)
		expect(keys).not.toContain('nodejs-22')
		expect(keys).not.toContain('nodejs-24')
	})

	it('merges Python 3.12 and 3.13 into one family', () => {
		const merged = mergeVariants([
			packageRecord(
				item({
					identifier: 'Python.Python.3.12',
					version: '3.12.10',
					name: 'Python 3.12',
					moniker: 'python3.12',
				}),
			),
			packageRecord(
				item({
					identifier: 'Python.Python.3.13',
					version: '3.13.1',
					name: 'Python 3.13',
					moniker: 'python3.13',
				}),
			),
		])
		expect(merged.map(record => record.identifier)).toEqual([
			'Python.Python',
		])
		expect(merged[0].names).toEqual(['python'])
		expect([...merged[0].candidates.keys()]).toEqual(['python'])
	})

	it('keeps Product 7 and Product 8 as distinct products', () => {
		const merged = mergeVariants([
			packageRecord(
				item({
					identifier: 'Vendor.Product.7',
					version: '2.0.0',
					name: 'Product 7',
					moniker: 'product7',
				}),
			),
			packageRecord(
				item({
					identifier: 'Vendor.Product.8',
					version: '3.0.0',
					name: 'Product 8',
					moniker: 'product8',
				}),
			),
		])
		expect(merged.map(record => record.identifier)).toEqual([
			'Vendor.Product.7',
			'Vendor.Product.8',
		])
		expect([...merged[0].candidates.keys()]).toContain('product7')
	})

	it('merges locale and installer variants regardless of version evidence', () => {
		const merged = mergeVariants([
			packageRecord(
				item({
					identifier: 'Mozilla.Firefox',
					name: 'Mozilla Firefox',
					publisher: 'Mozilla',
					commands: ['firefox'],
				}),
			),
			packageRecord(
				item({
					identifier: 'Mozilla.Firefox.ru',
					name: 'Mozilla Firefox (ru)',
					publisher: 'Mozilla',
				}),
			),
			packageRecord(
				item({
					identifier: 'Mozilla.Firefox.MSI',
					name: 'Mozilla Firefox',
					publisher: 'Mozilla',
				}),
			),
		])
		expect(merged.map(record => record.identifier)).toEqual([
			'Mozilla.Firefox',
		])
	})
})

describe('nameForms and candidates', () => {
	it('derives normalized, versionless, bracket-free and vendor-free forms', () => {
		expect(nameForms('Mozilla Firefox 156.0 (x64)', 'mozilla')).toEqual([
			'mozilla firefox 156.0 (x64)',
			'mozilla firefox',
			'mozilla firefox 156.0',
			'firefox 156.0 (x64)',
			'firefox',
			'firefox 156.0',
		])
		expect(nameForms('(Beta)', '')).toEqual([])
	})

	it('derives the product-side identifier token only when it is specific and vendor-free', () => {
		expect(
			derivedIdToken('Microsoft.VisualStudioCode', [
				'visual studio code',
			]),
		).toBe('visualstudiocode')
		expect(
			derivedIdToken('Google.Chrome.Beta', ['google chrome beta']),
		).toBe('chromebeta')
		expect(derivedIdToken('7zip.7zip', ['7-zip'])).toBe('7zip')
		expect(derivedIdToken('Vendor.App', [])).toBeNull()
		expect(derivedIdToken('Vendor.Ab', ['ab'])).toBeNull()
	})

	it('orders candidates moniker, portable alias, command, name form, derived token', () => {
		const candidates = candidateAliases(
			item({
				identifier: 'Kubernetes.kubectl',
				name: 'Kubernetes kubectl',
				moniker: 'kubectl',
				portableAliases: ['kubectl-portable'],
				commands: ['kube', 'kubectl'],
			}),
			['kubernetes kubectl'],
			'kubernetes',
		)
		expect([...candidates]).toEqual([
			['kubectl', 'moniker'],
			['kubectl-portable', 'portable'],
			['kube', 'command'],
			['kubernetes kubectl', 'name'],
		])
	})

	it('never emits the publisher itself as a candidate', () => {
		const candidates = candidateAliases(
			item({ identifier: 'Acme.Acme', name: 'Acme', moniker: 'acme' }),
			['acme'],
			'acme',
		)
		expect(candidates.size).toBe(0)
	})
})
