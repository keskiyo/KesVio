import { describe, expect, it } from 'vitest'
import {
	type AppInfo,
	MAX_LAUNCH_STATS,
	normalizeLaunchStats,
	rankByFrecency,
	recordLaunchStat,
} from '../../../../src/entities/app'

const DAY = 86_400_000
const NOW = 1_800_000_000_000

function app(id: string, name = id): AppInfo {
	return {
		id,
		name,
		path: `C:\\${id}.exe`,
		iconBase64: null,
		category: 'other',
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
	}
}

describe('launch history', () => {
	it('counts launches and remembers the latest one', () => {
		const once = recordLaunchStat({}, 'code', NOW - DAY)
		const twice = recordLaunchStat(once, 'code', NOW)

		expect(twice.code).toEqual({ count: 2, lastLaunchedAt: NOW })
		expect(once.code).toEqual({ count: 1, lastLaunchedAt: NOW - DAY })
	})

	it('keeps only the most recently launched entries past the cap', () => {
		let stats = {}
		for (let index = 0; index <= MAX_LAUNCH_STATS; index += 1)
			stats = recordLaunchStat(stats, `app-${index}`, NOW + index)

		expect(Object.keys(stats)).toHaveLength(MAX_LAUNCH_STATS)
		expect(stats).not.toHaveProperty('app-0')
		expect(stats).toHaveProperty(`app-${MAX_LAUNCH_STATS}`)
	})

	it('drops malformed entries without losing the good ones', () => {
		expect(
			normalizeLaunchStats({
				code: { count: 3, lastLaunchedAt: NOW },
				zero: { count: 0, lastLaunchedAt: NOW },
				fraction: { count: 1.5, lastLaunchedAt: NOW },
				noDate: { count: 2 },
				text: 'often',
				'  ': { count: 1, lastLaunchedAt: NOW },
			}),
		).toEqual({ code: { count: 3, lastLaunchedAt: NOW } })
		expect(normalizeLaunchStats(['code'])).toEqual({})
		expect(normalizeLaunchStats(null)).toEqual({})
	})

	it('ranks recent habits above old bursts and leaves unlaunched apps out', () => {
		const apps = [app('old'), app('fresh'), app('never'), app('often')]
		const stats = {
			old: { count: 20, lastLaunchedAt: NOW - 200 * DAY },
			fresh: { count: 2, lastLaunchedAt: NOW - DAY },
			often: { count: 9, lastLaunchedAt: NOW - 2 * DAY },
		}

		expect(rankByFrecency(apps, stats, NOW).map(entry => entry.id)).toEqual(
			['often', 'fresh', 'old'],
		)
	})
})
