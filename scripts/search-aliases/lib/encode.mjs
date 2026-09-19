// Serialises runtime records into the compact string-table JSON the application decodes, plus
// the typed wrapper module that carries the generated-file header.
import { GENERATOR_VERSION } from './policy.mjs'
import { MAX_NAMES_PER_RECORD } from './records.mjs'

export function encodeIndex(records, lock) {
	const strings = new Map()
	const intern = value => {
		let index = strings.get(value)
		if (index === undefined) {
			index = strings.size
			strings.set(value, index)
		}
		return index
	}
	const parenthesised = value => (value.endsWith(')') ? 1 : 0)
	const encoded = records.map(record => [
		intern(record.identifier),
		[...record.names]
			.sort((left, right) => parenthesised(left) - parenthesised(right))
			.slice(0, MAX_NAMES_PER_RECORD)
			.map(intern),
		record.soloNames.map(intern),
		record.publishers.map(intern),
		record.families.map(intern),
		record.executables.map(intern),
		record.aliases.flatMap(([value, confidence]) => [
			intern(value),
			confidence === 'weak' ? 1 : 0,
		]),
	])
	const body = JSON.stringify({
		version: 1,
		source: lock.source,
		commit: lock.commit,
		generator: GENERATOR_VERSION,
		strings: [...strings.keys()],
		records: encoded,
	})
	return { body, stringCount: strings.size }
}

export function wrapperModule(lock) {
	return [
		'// GENERATED FILE. DO NOT EDIT MANUALLY.',
		`// Source: ${lock.source} (MIT), manifests only`,
		`// Commit: ${lock.commit}`,
		`// Generator: scripts/search-aliases/generate.mjs v${GENERATOR_VERSION}`,
		'// Regenerate with: npm run aliases:generate',
		"import type { KnownPackageIndexData } from '../types'",
		"import data from './knownPackages.json'",
		'',
		'export const KNOWN_PACKAGE_INDEX = data as KnownPackageIndexData',
		'',
	].join('\n')
}
