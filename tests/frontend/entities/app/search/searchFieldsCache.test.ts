import { describe, expect, it } from 'vitest'
import { rankAppsByQuery } from '../../../../../src/entities/app/lib/catalogSearch'
import { fieldsFor } from '../../../../../src/entities/app/lib/search/searchFields'
import { app } from './fixtures/app'

// SearchFields live in a WeakMap keyed by the AppInfo object. The store replaces a patched
// record with a new object ({ ...app, ...patch }), which is exactly what invalidates the entry.
// A refactor that mutated AppInfo in place would keep serving aliases resolved from the old
// metadata; this file pins the contract from both sides.
describe('search field cache', () => {
	it('returns the same fields for the same record object', () => {
		const record = app({ id: 'a', name: 'Alpha' })
		expect(fieldsFor(record)).toBe(fieldsFor(record))
	})

	it('re-resolves aliases when a hydration patch produces a new record object', () => {
		const before = app({
			id: 'code',
			name: 'Visual Studio Code',
			path: String.raw`C:\Menu\Visual Studio Code.lnk`,
			launchKind: 'shortcut',
			sourceKind: 'start_menu',
		})
		expect(fieldsFor(before).aliasExact.get('vscode')).toBe('normal')

		const after = {
			...before,
			productName: 'Visual Studio Code',
			publisher: 'Microsoft Corporation',
		}
		expect(fieldsFor(after)).not.toBe(fieldsFor(before))
		expect(fieldsFor(after).aliasExact.get('vscode')).toBe('strong')
		expect(fieldsFor(before).aliasExact.get('vscode')).toBe('normal')
	})

	it('does not notice an in-place mutation, which is why the store must never do one', () => {
		const record = app({ id: 'm', name: 'Mutable' })
		fieldsFor(record)
		record.name = 'Renamed'
		expect(fieldsFor(record).name).toBe('mutable')
		expect(rankAppsByQuery([record], 'renamed')).toEqual([])
	})
})
