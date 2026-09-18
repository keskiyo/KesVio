import { describe, expect, it } from 'vitest'
import {
	catalogGenerationOrder,
	keepHeldRecords,
	mergeIcon,
	newerDiagnostics,
} from '../../../../src/app/store/catalogGeneration'
import type { AppInfo, CatalogDiagnostics } from '../../../../src/entities/app'

function app(id: string, iconBase64: string | null): AppInfo {
	return {
		id,
		name: id,
		path: `C:\\${id}.exe`,
		iconBase64,
		category: 'other',
		launchKind: 'executable',
		sourceKind: 'portable',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
	}
}

describe('catalog generation ordering', () => {
	it('orders an incoming generation against the one shown', () => {
		expect(catalogGenerationOrder(1, 2)).toBe('stale')
		expect(catalogGenerationOrder(2, 2)).toBe('same')
		expect(catalogGenerationOrder(3, 2)).toBe('newer')
		expect(catalogGenerationOrder(undefined, 0)).toBe('same')
	})

	it('keeps held records for the same generation and only icons for a newer one', () => {
		const held = [app('a', 'icon-a')]
		const incoming = [app('a', null), app('b', null)]

		expect(keepHeldRecords(held, incoming, 'same')[0]).toBe(held[0])
		const newer = keepHeldRecords(held, incoming, 'newer')
		expect(newer[0]).not.toBe(held[0])
		expect(newer[0]?.iconBase64).toBe('icon-a')
		expect(newer[1]?.iconBase64).toBeNull()
	})

	it('never drops an icon a patch already delivered', () => {
		expect(mergeIcon(app('a', 'kept'), app('a', null)).iconBase64).toBe(
			'kept',
		)
		expect(mergeIcon(app('a', 'old'), app('a', 'new')).iconBase64).toBe(
			'new',
		)
	})

	it('keeps the newest diagnostics by completion time', () => {
		const older = { completedAt: 10 } as CatalogDiagnostics
		const newer = { completedAt: 20 } as CatalogDiagnostics
		expect(newerDiagnostics(newer, older)).toBe(newer)
		expect(newerDiagnostics(older, newer)).toBe(newer)
		expect(newerDiagnostics(older, null)).toBe(older)
	})
})
