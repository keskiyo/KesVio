import type { AppInfo } from '../../model/app.types'

const KNOWN_VENDOR_PREFIXES = [
	'microsoft',
	'adobe',
	'google',
	'mozilla',
	'jetbrains',
	'oracle',
	'valve',
	'nvidia',
	'amd',
	'intel',
] as const

const EXECUTABLE_EXTENSIONS = /\.(exe|com|bat|cmd)$/
const TRAILING_BITNESS = /\s*\((?:x64|x86|64[- ]?bit|32[- ]?bit)\)$/
const TRAILING_VERSION = /\s+v?\d+(?:[.\-_]\d+)*$/
const ARCHITECTURE_SUFFIX = /(?:32|64|x86|x64)$/
const FILESYSTEM_PATH = /^(?:[a-z]:\\|\\\\)/i
const STEAM_LAUNCH = /^steam:\/\/rungameid\/(\d+)$/i
const IDENTITY_MARKS = /[®™©]/g
const IDENTITY_DASHES = /[‐-―−]/g
const MIN_STEM_LENGTH = 3

export function normalizeSearchAlias(value: string): string {
	return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

export function normalizeIdentityFact(value: string): string {
	return value
		.normalize('NFKC')
		.replace(IDENTITY_MARKS, '')
		.replace(IDENTITY_DASHES, '-')
		.trim()
		.toLocaleLowerCase()
		.replace(/\s+/g, ' ')
}

export function stripTrailingVersion(name: string): string {
	const withoutBitness = name.replace(TRAILING_BITNESS, '')
	const stripped = withoutBitness.replace(TRAILING_VERSION, '')
	return stripped.length >= MIN_STEM_LENGTH ? stripped : withoutBitness
}

export function stripKnownVendorPrefix(name: string): string {
	for (const vendor of KNOWN_VENDOR_PREFIXES) {
		if (!name.startsWith(`${vendor} `)) continue
		const rest = name.slice(vendor.length + 1).trim()
		if (rest.length >= MIN_STEM_LENGTH && /\p{L}/u.test(rest)) return rest
	}
	return name
}

export function executableStem(fileName: string): string | null {
	const normalized = normalizeIdentityFact(fileName).replace(/\.mui$/, '')
	if (!EXECUTABLE_EXTENSIONS.test(normalized)) return null
	const stem = normalized.replace(EXECUTABLE_EXTENSIONS, '')
	return stem.length >= 2 && /\p{L}/u.test(stem) ? stem : null
}

export function stripArchitectureSuffix(stem: string): string | null {
	const bare = stem.replace(ARCHITECTURE_SUFFIX, '')
	return bare !== stem &&
		bare.length >= MIN_STEM_LENGTH &&
		/\p{L}/u.test(bare)
		? bare
		: null
}

export function pathFileName(app: AppInfo): string | null {
	if (app.launchKind !== 'executable') return null
	if (!FILESYSTEM_PATH.test(app.path)) return null
	const base = normalizeIdentityFact(app.path.split(/[\\/]/).pop() ?? '')
	return EXECUTABLE_EXTENSIONS.test(base) ? base : null
}

export function metadataFileName(app: AppInfo): string | null {
	if (!app.originalFilename) return null
	const original = normalizeIdentityFact(app.originalFilename).replace(
		/\.mui$/,
		'',
	)
	return EXECUTABLE_EXTENSIONS.test(original) ? original : null
}

export function packageFamilyOf(app: AppInfo): string | null {
	if (app.launchKind !== 'app_user_model_id') return null
	const family = app.path.split('!')[0]?.toLocaleLowerCase() ?? ''
	return family.includes('_') ? family : null
}

export function steamAppIdOf(app: AppInfo): string | null {
	return STEAM_LAUNCH.exec(app.path.trim())?.[1] ?? null
}
