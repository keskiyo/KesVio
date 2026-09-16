import { describe, expect, it } from 'vitest'
import {
	joinHydrationIds,
	splitHydrationIds,
} from '../../../../src/entities/app/lib/hydrationIds'

describe('hydration id transport', () => {
	// Registry ids are `registry:<publisher>|<name>|<path>`; the old '|' separator split them into
	// three fragments the backend did not know, so registry-source records never received icons.
	it('round-trips ids that contain delimiter characters', () => {
		const ids = [
			'registry:oven|bun|c:\\users\\example\\.bun',
			'path:c:\\apps\\tool.lnk',
			'registry:oracle|mysql server|c:\\program files\\mysql',
			'registry:publisher|line one\nline two|c:\\apps\\multiline',
		]

		expect(splitHydrationIds(joinHydrationIds(ids))).toEqual(ids)
	})

	it('drops duplicates and empty entries', () => {
		expect(
			splitHydrationIds(joinHydrationIds(['a', 'a', '', 'b'])),
		).toEqual(['a', 'b'])
		expect(splitHydrationIds('')).toEqual([])
	})
})
