import { describe, expect, it, vi } from 'vitest'
import {
	elevationOffer,
	isElevationOffered,
} from '../../../../src/features/app-actions/lib/elevationOffer'
import type { AppInfo } from '../../../../src/entities/app'
import type { AppFileActions } from '../../../../src/features/app-actions'

const executable = {
	id: 'editor',
	name: 'Editor',
	path: String.raw`C:\Editor\editor.exe`,
	launchKind: 'executable',
} as AppInfo
const packaged = {
	...executable,
	id: 'store',
	path: 'Contoso.Store_123!App',
	launchKind: 'app_user_model_id',
} as AppInfo
const steam = {
	...executable,
	id: 'game',
	path: 'steam://rungameid/1',
} as AppInfo

function actions(windowsAnswer = true): AppFileActions {
	return {
		openFolder: vi.fn(),
		copyPath: vi.fn(),
		launchElevated: vi.fn(),
		canLaunchElevated: vi.fn().mockResolvedValue(windowsAnswer),
	}
}

describe('elevationOffer', () => {
	it('offers an executable, asks Windows for a packaged app and refuses a URI', () => {
		expect(elevationOffer(executable, false, actions())).toBe('offered')
		expect(elevationOffer(packaged, false, actions())).toBe('ask-windows')
		expect(elevationOffer(steam, false, actions())).toBe('refused')
	})

	it('never offers a hidden app or a client without elevation', () => {
		expect(elevationOffer(executable, true, actions())).toBe('refused')
		expect(
			elevationOffer(executable, false, {
				openFolder: vi.fn(),
				copyPath: vi.fn(),
			}),
		).toBe('refused')
	})

	it('follows the Windows answer for a packaged app', async () => {
		await expect(
			isElevationOffered(packaged, false, actions(true)),
		).resolves.toBe(true)
		await expect(
			isElevationOffered(packaged, false, actions(false)),
		).resolves.toBe(false)
		await expect(isElevationOffered(steam, false, actions())).resolves.toBe(
			false,
		)
	})
})
