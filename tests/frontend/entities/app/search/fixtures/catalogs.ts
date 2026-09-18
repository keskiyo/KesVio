import type { AppInfo } from '../../../../../../src/entities/app'
import { CREATIVE_WORKSTATION } from './catalogs/creativeWorkstation'
import { DEVELOPER_WORKSTATION } from './catalogs/developerWorkstation'
import { GAMING_WORKSTATION } from './catalogs/gamingWorkstation'
import { HELPER_HEAVY } from './catalogs/helperHeavy'
import { WINDOWS_EN } from './catalogs/windowsEn'
import { WINDOWS_RU } from './catalogs/windowsRu'

export type CatalogName =
	| 'windows-en'
	| 'windows-ru'
	| 'developer'
	| 'gaming'
	| 'creative'
	| 'helper-heavy'

export const CATALOGS: Record<CatalogName, AppInfo[]> = {
	'windows-en': WINDOWS_EN,
	'windows-ru': WINDOWS_RU,
	developer: DEVELOPER_WORKSTATION,
	gaming: GAMING_WORKSTATION,
	creative: CREATIVE_WORKSTATION,
	'helper-heavy': HELPER_HEAVY,
}
