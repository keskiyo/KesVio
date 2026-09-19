// Turns one winget manifest into a package record (identity facts + alias candidates) and
// merges the locale, installer and version variants of a product into one canonical record.
import {
	aliasValue,
	isGenericName,
	isUsableExecutable,
	normalizeName,
	publisherToken,
	versionlessName,
} from './policy.mjs'

export const MAX_NAMES_PER_RECORD = 8
export const MAX_EXECUTABLES_PER_RECORD = 6

const PARENTHETICAL = /\s*\([^()]*\)\s*$/
const VARIANT_SEGMENT =
	/^(?:[a-z]{2,3}|[a-z]{2,3}-[a-zA-Z]{2,8}|[xX]64|[xX]86|[aA][rR][mM]64|[aA][rR][mM]|EXE|MSI|MSIX|ZIP|Portable|Installer|Setup|User|Machine)$/
const VERSION_SEGMENT = /^(?:v?\d+(?:_\d+)*|LTS)$/i
const VERSIONED_VALUE = /(?:\d+[._]\d+|[-_ .]?v?\d+(?:[._]\d+)*$)/

export function nameForms(raw, publisher) {
	const forms = new Set()
	const push = value => {
		const normalized = normalizeName(value)
		if (!normalized) return
		forms.add(normalized)
		forms.add(versionlessName(value))
	}
	push(raw)
	let stripped = raw
	while (PARENTHETICAL.test(stripped)) {
		stripped = stripped.replace(PARENTHETICAL, '')
		push(stripped)
	}
	for (const form of [...forms])
		if (publisher && form.startsWith(`${publisher} `))
			forms.add(form.slice(publisher.length + 1))
	return [...forms].filter(value => !isGenericName(value))
}

function normalizedNames(source, publisher) {
	const names = new Set()
	for (const raw of [
		source.name,
		...source.displayNames,
		...source.localizedNames,
	]) {
		if (typeof raw !== 'string' || !raw.trim()) continue
		for (const form of nameForms(raw, publisher)) names.add(form)
	}
	return [...names].slice(0, MAX_NAMES_PER_RECORD)
}

function splitIdentifier(identifier) {
	const segments = identifier.split('.')
	const suffix = []
	while (
		segments.length > 2 &&
		(VARIANT_SEGMENT.test(segments[segments.length - 1]) ||
			VERSION_SEGMENT.test(segments[segments.length - 1]))
	)
		suffix.unshift(segments.pop())
	return { base: segments.join('.'), suffix }
}

export function canonicalIdentifier(identifier) {
	return splitIdentifier(identifier).base
}

function versionSuffix(identifier) {
	const numeric = splitIdentifier(identifier)
		.suffix.filter(segment => VERSION_SEGMENT.test(segment))
		.map(segment => segment.replace(/^v/i, '').replace(/_/g, '.'))
	return numeric.length > 0 ? numeric.join('.') : null
}

function nameCarriesSuffix(displayName, suffix) {
	if (!displayName || /^lts$/i.test(suffix)) return false
	const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return new RegExp(`(?:^|[\\s.\\-_])v?${escaped}(?:\\s|$)`).test(displayName)
}

// A numeric identifier suffix is a version only with evidence: the manifest version starts
// with it (Python.Python.3.12 at 3.12.10), or sibling identifiers form a family while the
// display name does not carry the number. `Vendor.Product.7` named "Product 7" at version
// 2.0.0 stays its own product.
export function isVersionFamilyMember(record, siblingCount) {
	const suffix = versionSuffix(record.identifier)
	if (suffix === null) return false
	if (/^lts$/i.test(suffix)) return siblingCount >= 2
	const versionAgrees =
		record.version === suffix ||
		record.version.startsWith(`${suffix}.`) ||
		record.version.startsWith(`${suffix}-`)
	if (versionAgrees) return true
	return siblingCount >= 2 && !nameCarriesSuffix(record.displayName, suffix)
}

function withoutVersionedForms(record) {
	const unversioned = value =>
		versionlessName(value) === value && !VERSIONED_VALUE.test(value)
	const candidates = new Map()
	for (const [value, kind] of record.candidates)
		if (unversioned(value)) candidates.set(value, kind)
	return { ...record, names: record.names.filter(unversioned), candidates }
}

export function derivedIdToken(identifier, names) {
	const segment = canonicalIdentifier(identifier).split('.').slice(1).join('')
	const token = aliasValue(segment)
	if (!/^[a-z0-9+#.-]+$/.test(token) || [...token].length < 4) return null
	if (names.some(name => name.replace(/[\s-]/g, '') === token)) return token
	return names.length === 0 ? null : token
}

export function candidateAliases(source, names, publisher) {
	const candidates = new Map()
	const add = (raw, kind) => {
		const value = aliasValue(raw)
		if (!value || value === publisher) return
		if (!candidates.has(value)) candidates.set(value, kind)
	}
	if (source.moniker) add(source.moniker, 'moniker')
	for (const alias of source.portableAliases ?? []) add(alias, 'portable')
	for (const command of source.commands) add(command, 'command')
	for (const name of source.name ? nameForms(source.name, publisher) : [])
		if (!/\)$/.test(name)) add(name, 'name')
	const token = derivedIdToken(source.identifier, names)
	if (token) add(token, 'derived')
	return candidates
}

export function packageRecord(item) {
	const publisher = publisherToken(item.publisher || item.publishers[0] || '')
	const names = normalizedNames(item, publisher)
	return {
		identifier: item.identifier,
		version: item.version,
		displayName: normalizeName(item.name),
		names,
		publishers: [
			...new Set(
				[publisher, ...item.publishers.map(publisherToken)].filter(
					Boolean,
				),
			),
		],
		families: [
			...new Set(item.families.map(value => value.toLocaleLowerCase())),
		],
		executables: [
			...new Set(
				item.executables
					.map(value => value.toLocaleLowerCase())
					.filter(isUsableExecutable),
			),
		].slice(0, MAX_EXECUTABLES_PER_RECORD),
		candidates: candidateAliases(item, names, publisher),
		hasMoniker: Boolean(item.moniker),
		hasCommands: item.commands.length > 0,
	}
}

function mergeInto(target, record) {
	target.names = [...new Set([...target.names, ...record.names])].slice(
		0,
		MAX_NAMES_PER_RECORD,
	)
	target.publishers = [
		...new Set([...target.publishers, ...record.publishers]),
	]
	target.families = [...new Set([...target.families, ...record.families])]
	target.executables = [
		...new Set([...target.executables, ...record.executables]),
	].slice(0, MAX_EXECUTABLES_PER_RECORD)
	for (const [value, kind] of record.candidates)
		if (!target.candidates.has(value)) target.candidates.set(value, kind)
	target.hasMoniker ||= record.hasMoniker
	target.hasCommands ||= record.hasCommands
}

export function mergeVariants(packages) {
	const siblings = new Map()
	for (const record of packages) {
		const base = canonicalIdentifier(record.identifier)
		if (versionSuffix(record.identifier) !== null)
			siblings.set(base, (siblings.get(base) ?? 0) + 1)
	}
	const merged = new Map()
	for (const variant of packages) {
		const base = canonicalIdentifier(variant.identifier)
		const versioned = versionSuffix(variant.identifier) !== null
		const collapse =
			!versioned ||
			isVersionFamilyMember(variant, siblings.get(base) ?? 0)
		const canonical = collapse ? base : variant.identifier
		const record =
			collapse && versioned ? withoutVersionedForms(variant) : variant
		const target = merged.get(canonical)
		if (!target) merged.set(canonical, { ...record, identifier: canonical })
		else mergeInto(target, record)
	}
	return [...merged.values()]
}
