import { describe, expect, it } from 'vitest'
import {
	type AppInfo,
	auxiliaryReason,
	groupAppVersions,
	newerInstalledVersions,
} from '../../../../src/entities/app'

function app(id: string, extra: Partial<AppInfo> = {}): AppInfo {
	return {
		id,
		name: id,
		path: `C:\\${id}.exe`,
		iconBase64: null,
		category: 'other',
		launchKind: 'executable',
		sourceKind: 'portable',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		...extra,
	}
}

describe('groupAppVersions', () => {
	it('keeps the newest version of one product in front, comparing numerically', () => {
		const groups = groupAppVersions([
			app('a', { name: 'Bun', publisher: 'Oven', version: '1.3.9' }),
			app('b', { name: 'Bun', publisher: 'Oven', version: '1.3.14' }),
			app('c', { name: 'Deno', publisher: 'Deno Land', version: '2.7' }),
		])

		expect(groups.map(group => group.primary.id)).toEqual(['b', 'c'])
		expect(groups[0]?.older.map(entry => entry.id)).toEqual(['a'])
	})

	it('treats setup wording, architecture and versions in the name as the same product', () => {
		const groups = groupAppVersions([
			app('a', { name: 'Editor Setup 2.1 x64', publisher: 'Maker' }),
			app('b', { name: 'Editor', publisher: 'Maker' }),
		])

		expect(groups).toHaveLength(1)
	})

	it('keeps products of different publishers apart', () => {
		const groups = groupAppVersions([
			app('a', { name: 'Notes', publisher: 'One' }),
			app('b', { name: 'Notes', publisher: 'Two' }),
		])

		expect(groups).toHaveLength(2)
	})
})

describe('newerInstalledVersions', () => {
	it('reports the installed version only when it is newer than the installer', () => {
		const installers = [
			app('old', {
				name: '7-Zip',
				publisher: 'Igor Pavlov',
				version: '23.01',
			}),
			app('same', { name: 'Tool', publisher: 'Maker', version: '2.0' }),
		]
		const installed = [
			app('7z', {
				name: '7-Zip',
				publisher: 'Igor Pavlov',
				version: '25.01',
			}),
			app('tool', { name: 'Tool', publisher: 'Maker', version: '2.0' }),
		]

		expect([...newerInstalledVersions(installers, installed)]).toEqual([
			['old', '25.01'],
		])
	})

	it('compares nothing without a publisher or a version on both sides', () => {
		const installers = [app('old', { name: '7-Zip', version: '23.01' })]
		const installed = [
			app('7z', {
				name: '7-Zip',
				publisher: 'Igor Pavlov',
				version: '25.01',
			}),
		]

		expect(newerInstalledVersions(installers, installed).size).toBe(0)
	})
})

describe('auxiliaryReason', () => {
	it('picks the reason that explains an auxiliary entry, not a registration signal', () => {
		expect(
			auxiliaryReason({
				visibilityReasons: [
					'start_menu_registration',
					'console_application',
				],
			}),
		).toBe('console_application')
		expect(
			auxiliaryReason({ visibilityReasons: ['start_menu_registration'] }),
		).toBeNull()
		expect(auxiliaryReason({})).toBeNull()
	})
})
