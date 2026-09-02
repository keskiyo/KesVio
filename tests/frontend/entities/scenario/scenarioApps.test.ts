import { describe, expect, it } from 'vitest'
import { resolveScenarioApps } from '../../../../src/entities/scenario'
import type { AppInfo } from '../../../../src/entities/app'

function app(value: Partial<AppInfo> & Pick<AppInfo, 'id'>): AppInfo {
	return {
		name: value.id,
		path: `C:\\Apps\\${value.id}.exe`,
		category: 'other',
		iconBase64: null,
		launchKind: 'executable',
		sourceKind: 'registry',
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		...value,
	}
}

describe('resolveScenarioApps', () => {
	it('keeps the stored order rather than the catalog order', () => {
		const catalog = [app({ id: 'a' }), app({ id: 'b' }), app({ id: 'c' })]

		const resolved = resolveScenarioApps(['c', 'a'], catalog)

		expect(resolved.apps.map(entry => entry.id)).toEqual(['c', 'a'])
		expect(resolved.unavailable).toEqual([])
	})

	it('returns last known metadata for entries the catalog no longer contains', () => {
		const resolved = resolveScenarioApps(
			['gone', 'a', 'also-gone'],
			[app({ id: 'a' })],
			{
				gone: {
					name: 'ChatGPT',
					iconBase64: 'data:image/png;base64,AAAA',
				},
			},
		)

		expect(resolved.apps.map(entry => entry.id)).toEqual(['a'])
		expect(resolved.unavailable).toEqual([
			{
				identity: 'gone',
				name: 'ChatGPT',
				iconBase64: 'data:image/png;base64,AAAA',
			},
			{
				identity: 'also-gone',
				name: 'Unavailable application',
				iconBase64: null,
			},
		])
	})

	// The durable key is the preference identity, so a rescan that renames the catalog id must
	// still resolve — that is the whole reason scenarios do not store ids.
	it('resolves through the preference identity, not the catalog id', () => {
		const rescanned = [
			app({ id: 'code-v2', preferenceIdentity: 'preference:code' }),
		]

		const resolved = resolveScenarioApps(['preference:code'], rescanned)

		expect(resolved.apps.map(entry => entry.id)).toEqual(['code-v2'])
		expect(resolved.unavailable).toEqual([])
	})

	// A scenario saved before the record gained a preference identity stored whatever
	// appIdentity returned then — the canonical identity, or the catalog id. Resolving only
	// through today's primary key turned those entries into tombstones.
	it('still resolves an entry stored under an older durable key', () => {
		const catalog = [
			app({
				id: 'code-v3',
				preferenceIdentity: 'preference:code',
				canonicalIdentity: 'identity:code',
			}),
		]

		for (const stored of ['identity:code', 'code-v3']) {
			const resolved = resolveScenarioApps([stored], catalog)

			expect(resolved.apps.map(entry => entry.id)).toEqual(['code-v3'])
			expect(resolved.unavailable).toEqual([])
		}
	})

	it('never lets an alias shadow a primary identity of another record', () => {
		const catalog = [
			app({ id: 'shared', preferenceIdentity: 'preference:first' }),
			app({ id: 'second', preferenceIdentity: 'shared' }),
		]

		const resolved = resolveScenarioApps(['shared'], catalog)

		expect(resolved.apps.map(entry => entry.id)).toEqual(['second'])
	})

	it('recovers a uniquely named app after its preference identity changes', () => {
		const catalog = [
			app({
				id: 'code-current',
				name: 'Visual Studio Code',
				preferenceIdentity: 'preference:current-code',
			}),
		]

		const resolved = resolveScenarioApps(['preference:old-code'], catalog, {
			'preference:old-code': {
				name: 'Visual Studio Code',
				iconBase64: null,
			},
		})

		expect(resolved.apps.map(entry => entry.id)).toEqual(['code-current'])
		expect(resolved.unavailable).toEqual([])
	})

	it('keeps a stale identity unavailable when its snapshot name is ambiguous', () => {
		const catalog = [
			app({ id: 'editor-one', name: 'Editor' }),
			app({ id: 'editor-two', name: 'Editor' }),
		]

		const resolved = resolveScenarioApps(
			['preference:old-editor'],
			catalog,
			{
				'preference:old-editor': { name: 'Editor', iconBase64: null },
			},
		)

		expect(resolved.apps).toEqual([])
		expect(resolved.unavailable).toEqual([
			{
				identity: 'preference:old-editor',
				name: 'Editor',
				iconBase64: null,
			},
		])
	})
})
