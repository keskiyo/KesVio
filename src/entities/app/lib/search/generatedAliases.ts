import type { AppInfo } from '../../model/app.types'
import {
	executableStem,
	normalizeSearchAlias,
	stripArchitectureSuffix,
	stripKnownVendorPrefix,
	stripTrailingVersion,
} from './aliasText'
import { isHelperRecord } from './helperRecords'
import { appMatchFacts } from './knownAliasMatch'
import type { AppMatchFacts, SearchAlias } from './types'

const GENERIC_WORDS = new Set([
	'setup',
	'install',
	'installer',
	'uninstall',
	'uninstaller',
	'launcher',
	'app',
	'application',
	'main',
	'start',
	'run',
	'update',
	'updater',
	'helper',
	'bin',
	'manager',
	'client',
	'server',
	'service',
	'software',
	'tools',
	'tool',
	'center',
	'panel',
	'control',
	'console',
	'host',
	'runtime',
	'agent',
	'daemon',
])

const HOST_STEMS = new Set([
	'electron',
	'chrome',
	'chrome_proxy',
	'msedge',
	'msedge_proxy',
	'msedgewebview2',
	'wscript',
	'cscript',
	'rundll32',
	'mshta',
	'dllhost',
	'explorer',
	'python',
	'pythonw',
	'py',
	'java',
	'javaw',
	'node',
	'pwsh',
	'powershell',
	'cmd',
])

const BROWSER_HOSTS = new Set([
	'chrome.exe',
	'chrome_proxy.exe',
	'msedge.exe',
	'msedge_proxy.exe',
	'msedgewebview2.exe',
	'firefox.exe',
	'brave.exe',
	'opera.exe',
	'browser.exe',
	'vivaldi.exe',
])

const OPERATING_SYSTEM_PRODUCT = /operating system|операционная система/i

const ACRONYM_STOP_WORDS = new Set(['the', 'for', 'and', 'of', 'a', 'an'])
const MIN_ACRONYM_LENGTH = 3
const MAX_ACRONYM_LENGTH = 8

export function generateAppAliases(
	app: AppInfo,
	facts: AppMatchFacts = appMatchFacts(app),
): SearchAlias[] {
	const name = normalizeSearchAlias(app.name)
	const aliases: SearchAlias[] = []
	const add = (value: string, confidence: SearchAlias['confidence']) => {
		const normalized = normalizeSearchAlias(value)
		if (normalized && normalized !== name)
			aliases.push({ value: normalized, confidence })
	}

	const versionless = stripTrailingVersion(name)
	add(versionless, 'normal')
	if (isHelperRecord(facts)) return aliases

	const fileName = facts.pathExecutable
	const stem = fileName ? executableStem(fileName) : null
	const hostMetadata =
		(stem !== null && HOST_STEMS.has(stem)) ||
		BROWSER_HOSTS.has(facts.originalFilename ?? '')
	if (
		app.productName &&
		!hostMetadata &&
		!OPERATING_SYSTEM_PRODUCT.test(app.productName)
	)
		add(app.productName, 'normal')
	if (fileName && stem && !GENERIC_WORDS.has(stem) && !HOST_STEMS.has(stem)) {
		add(fileName, 'normal')
		add(stem, 'normal')
		const bare = stripArchitectureSuffix(stem)
		if (bare && !GENERIC_WORDS.has(bare) && !HOST_STEMS.has(bare))
			add(bare, 'normal')
	}

	const unbranded = stripKnownVendorPrefix(versionless)
	if (
		unbranded !== versionless &&
		!unbranded.includes(' ') &&
		!GENERIC_WORDS.has(unbranded)
	)
		add(unbranded, 'normal')
	for (const acronym of acronymsOf(unbranded)) add(acronym, 'weak')
	return aliases
}

function acronymsOf(name: string): string[] {
	const words = name.split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 0)
	if (words.some(word => GENERIC_WORDS.has(word))) return []
	const meaningful = words.filter(word => !ACRONYM_STOP_WORDS.has(word))
	return [...new Set([initials(words), initials(meaningful)])].filter(
		(acronym): acronym is string => acronym !== null,
	)
}

function initials(words: string[]): string | null {
	if (words.length < MIN_ACRONYM_LENGTH) return null
	const acronym = words.map(word => word[0]).join('')
	return acronym.length <= MAX_ACRONYM_LENGTH &&
		(/^[a-z]+$/.test(acronym) || /^[а-яё]+$/.test(acronym))
		? acronym
		: null
}
