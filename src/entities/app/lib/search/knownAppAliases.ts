import { BROWSERS, COMMUNICATION } from './dictionary/browsersAndChat'
import { CREATIVE, OFFICE } from './dictionary/creativeAndOffice'
import { DATABASES } from './dictionary/databases'
import { DEVELOPMENT } from './dictionary/development'
import { GAMING, MEDIA } from './dictionary/mediaAndGames'
import { HARDWARE, UTILITIES } from './dictionary/utilitiesAndHardware'
import { WINDOWS_TOOLS } from './dictionary/windowsTools'
import type { KnownAppAliasEntry } from './types'

export const KNOWN_APP_ALIASES: readonly KnownAppAliasEntry[] = Object.freeze([
	...WINDOWS_TOOLS,
	...DEVELOPMENT,
	...DATABASES,
	...BROWSERS,
	...COMMUNICATION,
	...MEDIA,
	...GAMING,
	...UTILITIES,
	...HARDWARE,
	...CREATIVE,
	...OFFICE,
])
