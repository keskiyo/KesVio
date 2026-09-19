import {
	FORBIDDEN_ALIAS_VALUES,
	GENERIC_COMMANDS,
	GENERIC_NAMES,
	GENERIC_WORDS,
	HOST_STEMS,
} from '../../../src/entities/app/lib/search/aliasPolicy.ts'
import {
	normalizeIdentityFact,
	normalizeSearchAlias,
	stripTrailingVersion,
} from '../../../src/entities/app/lib/search/aliasText.ts'
import { isHelperName } from '../../../src/entities/app/lib/search/helperRecords.ts'
import { KNOWN_APP_ALIASES } from '../../../src/entities/app/lib/search/knownAppAliases.ts'

export const GENERATOR_VERSION = 2
export const MAX_ALIASES_PER_RECORD = 10
export const MIN_SOLO_NAME_LENGTH = 4

// Legal forms and organisation words stripped from the end of a publisher only, so that
// `Adobe Inc.`, `Adobe Systems Incorporated` and `Adobe` share the key `adobe` while
// `Electronic Arts` keeps both words.
const LEGAL_SUFFIXES = new Set([
	'inc',
	'inc.',
	'incorporated',
	'llc',
	'llc.',
	'ltd',
	'ltd.',
	'limited',
	'corporation',
	'corp',
	'corp.',
	'co',
	'co.',
	'company',
	'gmbh',
	'ag',
	'sa',
	's.a.',
	'sarl',
	'sas',
	'bv',
	'b.v.',
	'oy',
	'ab',
	'plc',
	'llp',
	'kg',
	'srl',
	's.r.l.',
	's.r.o.',
	'pty',
	'e.v.',
	'foundation',
	'software',
	'technologies',
	'technology',
	'systems',
	'labs',
	'studio',
	'studios',
	'team',
	'project',
	'developers',
	'community',
])

const HELPER_EXECUTABLE =
	/setup|install|updat|uninstall|helper|crash|agent|service|launcher|sender|container|daemon|proxy|maintenance|diagnos|report|telemetry|handler|watchdog|tray|notif|unbranded/
const HIGH_RISK_NAME =
	/(?:^|\s)(?:setup|install(?:er)?|updat(?:e|er)|uninstall(?:er)?|driver|drivers|runtime|redistributable|patch|hotfix|preview|beta|alpha|nightly|canary)(?:\s|$)/
const ALIAS_CHARACTERS = /^[a-z0-9+#.\-_ '&!]+$/
const URL_LIKE = /:\/\/|www\.|<http|mailto:/
const INSTALLER_SWITCH = /^[-/]/

export const CANDIDATE_PRIORITY = {
	moniker: 0,
	portable: 1,
	command: 2,
	name: 3,
	derived: 4,
}

const DOMAIN_SUFFIX = /\.(?:com|org|net|io|dev|app|co|de|ru|fr|uk)$/

export function normalizePublisherIdentity(publisher) {
	const full = normalizeIdentityFact(publisher).replace(/[,]/g, '')
	if (!full) return { full: '', key: '' }
	const words = full.split(' ').filter(Boolean)
	while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1]))
		words.pop()
	if (words[0] === 'the' && words.length > 1) words.shift()
	const last = words[words.length - 1].replace(DOMAIN_SUFFIX, '')
	if (last.length >= 3) words[words.length - 1] = last
	const key = words.join(' ')
	return { full, key: key.length >= 3 ? key : full }
}

export function publisherToken(publisher) {
	return normalizePublisherIdentity(publisher).key
}

export function curatedAliasValues() {
	const strong = new Set()
	const any = new Set()
	const names = new Set()
	const walk = clause => {
		if ('allOf' in clause) clause.allOf.forEach(walk)
		else if ('name' in clause)
			clause.name.forEach(value => names.add(value))
	}
	for (const entry of KNOWN_APP_ALIASES) {
		for (const [value, confidence] of entry.aliases) {
			any.add(value)
			if (confidence === 'strong') strong.add(value)
		}
		entry.match.anyOf.forEach(walk)
	}
	return { strong, any, names }
}

export function normalizeName(value) {
	return normalizeIdentityFact(value)
}

export function versionlessName(value) {
	return stripTrailingVersion(normalizeIdentityFact(value))
}

export function isGenericName(value) {
	return (
		GENERIC_NAMES.has(value) ||
		value.length < 3 ||
		!/\p{L}/u.test(value.replace(/\([^)]*\)/g, '')) ||
		value.startsWith('(')
	)
}

function isCategoryOnly(name) {
	const words = name.split(/[^\p{L}\p{N}+#]+/u).filter(Boolean)
	return (
		words.length > 0 &&
		words.every(
			word =>
				GENERIC_WORDS.has(word) ||
				GENERIC_NAMES.has(word) ||
				FORBIDDEN_ALIAS_VALUES.has(word),
		)
	)
}

// A package name may identify a record on its own only when the name is specific enough that
// an unrelated local application is unlikely to carry it; even then the runtime grants weak.
export function isSafeSoloExternalName(name, context) {
	if ([...name].length < MIN_SOLO_NAME_LENGTH) return false
	if (!/\p{L}/u.test(name)) return false
	if (isGenericName(name) || isCategoryOnly(name)) return false
	if (FORBIDDEN_ALIAS_VALUES.has(name) || GENERIC_WORDS.has(name))
		return false
	if (HOST_STEMS.has(name)) return false
	if (isHelperName(name) || HIGH_RISK_NAME.test(name)) return false
	if (URL_LIKE.test(name) || /[\\/]/.test(name)) return false
	if (context.curatedNames.has(name)) return false
	if (context.publisherKey && name === context.publisherKey) return false
	return (context.owners.get(name) ?? 0) === 1
}

export function isUsableExecutable(fileName) {
	const stem = fileName.replace(/\.(exe|com|bat|cmd)$/, '')
	return (
		/\p{L}/u.test(stem) &&
		!HOST_STEMS.has(stem) &&
		!GENERIC_WORDS.has(stem) &&
		!HELPER_EXECUTABLE.test(stem)
	)
}

export function aliasValue(value) {
	return normalizeSearchAlias(value)
}

export function forbiddenReason(value, kind) {
	const length = [...value].length
	if (length <= 2) return 'too_short'
	if (FORBIDDEN_ALIAS_VALUES.has(value)) return 'semantic'
	if (GENERIC_WORDS.has(value) || GENERIC_NAMES.has(value)) return 'generic'
	if (HOST_STEMS.has(value)) return 'host'
	if (kind === 'command' && GENERIC_COMMANDS.has(value))
		return 'generic_command'
	if (
		(kind === 'command' || kind === 'portable') &&
		HELPER_EXECUTABLE.test(value)
	)
		return 'helper_command'
	if (!/\p{L}/u.test(value)) return 'no_letters'
	if (
		INSTALLER_SWITCH.test(value) ||
		URL_LIKE.test(value) ||
		/[\\/:*?"<>|]/.test(value) ||
		!ALIAS_CHARACTERS.test(
			value.normalize('NFKC').replace(/[\p{L}\p{N}]/gu, 'a'),
		)
	)
		return 'invalid_characters'
	return null
}

export function confidenceFor(value, collisions, kind) {
	const length = [...value].length
	if (length === 3)
		return collisions === 1 && kind !== 'derived' ? 'weak' : null
	if (collisions === 1) return 'normal'
	if (collisions <= 3) return 'weak'
	return null
}
