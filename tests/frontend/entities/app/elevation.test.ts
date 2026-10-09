import { describe, expect, it } from 'vitest'
import {
	canOpenFolderFromMenu,
	elevationSupport,
} from '../../../../src/entities/app'

describe('menu eligibility', () => {
	it('elevates files on disk, asks Windows about app ids, never elevates links', () => {
		expect(
			elevationSupport({ launchKind: 'executable', path: 'C:\\a.exe' }),
		).toBe('available')
		expect(
			elevationSupport({ launchKind: 'shortcut', path: 'C:\\a.lnk' }),
		).toBe('available')
		expect(
			elevationSupport({
				launchKind: 'app_user_model_id',
				path: '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\cmd.exe',
			}),
		).toBe('ask-windows')
		expect(
			elevationSupport({
				launchKind: 'executable',
				path: '  STEAM://rungameid/1',
			}),
		).toBe('unavailable')
	})

	it('offers a folder for files and Windows Start Apps, not packaged apps', () => {
		const file = { sourceKind: 'registry', platformKind: null } as const
		expect(
			canOpenFolderFromMenu({ ...file, launchKind: 'executable' }),
		).toBe(true)
		expect(canOpenFolderFromMenu({ ...file, launchKind: 'shortcut' })).toBe(
			true,
		)
		expect(
			canOpenFolderFromMenu({
				launchKind: 'app_user_model_id',
				sourceKind: 'start_apps',
				platformKind: null,
			}),
		).toBe(true)
		expect(
			canOpenFolderFromMenu({
				launchKind: 'app_user_model_id',
				sourceKind: 'msix',
				platformKind: 'microsoft_store',
			}),
		).toBe(false)
		expect(
			canOpenFolderFromMenu({
				launchKind: 'app_user_model_id',
				sourceKind: 'start_apps',
				platformKind: 'microsoft_store',
			}),
		).toBe(false)
	})
})
