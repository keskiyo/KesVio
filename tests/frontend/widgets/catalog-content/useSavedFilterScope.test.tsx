import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSavedFilterScope } from '../../../../src/widgets/catalog-content/model/useSavedFilterScope'
import {
	appIdentity,
	EMPTY_CRITERIA,
	type AppInfo,
	type AppView,
} from '../../../../src/entities/app'

const editor: AppInfo = {
	id: 'editor',
	name: 'Editor',
	path: 'C:\\Editor.exe',
	iconBase64: null,
	category: 'other',
	launchKind: 'executable',
	sourceKind: 'portable',
	platformKind: null,
	description: null,
	version: null,
	publisher: 'Example',
	installLocation: null,
	canUninstall: false,
}
const now = 1_800_000_000_000
const state = {
	activeView: 'all' as AppView,
	activeSavedFilterId: 'filter:recent',
	savedFilters: [
		{
			id: 'filter:recent',
			name: 'Recent',
			criteria: { ...EMPTY_CRITERIA, addedWithinDays: 1 },
		},
	],
	firstSeenAt: { [appIdentity(editor)]: now - 86_400_000 + 30_000 },
}

afterEach(() => vi.useRealTimers())

describe('saved filter live scope', () => {
	it('expires records as time advances and stops its clock outside the catalog', () => {
		vi.useFakeTimers()
		vi.setSystemTime(now)
		const { result, rerender, unmount } = renderHook(
			props => useSavedFilterScope(props, [editor]),
			{ initialProps: state },
		)
		expect(result.current.scopedApps).toEqual([editor])
		act(() => vi.advanceTimersByTime(60_000))
		expect(result.current.scopedApps).toEqual([])
		rerender({ ...state, activeView: 'settings' })
		expect(vi.getTimerCount()).toBe(0)
		rerender(state)
		expect(vi.getTimerCount()).toBe(1)
		unmount()
		expect(vi.getTimerCount()).toBe(0)
	})

	it('recomputes on catalog changes without capturing a saved list of ids', () => {
		const scope = {
			...state,
			savedFilters: [
				{
					...state.savedFilters[0],
					criteria: { ...EMPTY_CRITERIA, publishers: ['Example'] },
				},
			],
		}
		const { result, rerender } = renderHook(
			apps => useSavedFilterScope(scope, apps),
			{ initialProps: [editor] },
		)
		expect(result.current.scopedApps).toEqual([editor])
		rerender([{ ...editor, publisher: 'Other' }])
		expect(result.current.scopedApps).toEqual([])
		rerender([{ ...editor, id: 'new-editor' }])
		expect(result.current.scopedApps.map(app => app.id)).toEqual([
			'new-editor',
		])
	})
})
