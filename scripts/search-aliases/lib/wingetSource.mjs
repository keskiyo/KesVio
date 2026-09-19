import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'yaml'

// One package = the directory that holds version directories. A version directory holds
// `<Id>.yaml` (ManifestType: version), `<Id>.installer.yaml` and `<Id>.locale.<tag>.yaml`, or a
// single `<Id>.yaml` with ManifestType: singleton (old manifests). Sub-packages (Microsoft.
// VisualStudioCode/Insiders) are separate packages one level deeper.
//
// Manifest content is untrusted build input: every field is read through `text` / `list` /
// `mapping`, which accept only the expected shape, bound string length and never evaluate
// anything. The YAML parser runs in its default safe mode (core schema, no custom tags).

const EXECUTABLE = /\.(exe|com|bat|cmd)$/i
const MAX_TEXT_LENGTH = 256
const MAX_LIST_LENGTH = 64
const PARSE_OPTIONS = {
	version: '1.2',
	schema: 'core',
	uniqueKeys: false,
	maxAliasCount: 200,
	logLevel: 'silent',
}

export function parseManifest(source) {
	return parse(source, PARSE_OPTIONS)
}

export function mapping(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? value
		: null
}

export function text(value) {
	if (typeof value !== 'string') return ''
	const trimmed = value.trim()
	return trimmed.length > MAX_TEXT_LENGTH ? '' : trimmed
}

export function list(value) {
	const items = Array.isArray(value) ? value : [value]
	return items.map(text).filter(Boolean).slice(0, MAX_LIST_LENGTH)
}

function mappings(value) {
	return (Array.isArray(value) ? value : []).map(mapping).filter(Boolean)
}

export function compareVersions(left, right) {
	const a = left.split(/[.\-+_ ]/)
	const b = right.split(/[.\-+_ ]/)
	for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
		const x = a[index] ?? ''
		const y = b[index] ?? ''
		const nx = /^\d+$/.test(x) ? Number(x) : NaN
		const ny = /^\d+$/.test(y) ? Number(y) : NaN
		if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
			if (nx !== ny) return nx - ny
			continue
		}
		if (x !== y) return x < y ? -1 : 1
	}
	return 0
}

function readManifests(versionDirectory, identifier, failures) {
	const files = readdirSync(versionDirectory)
	const read = name => {
		try {
			return (
				mapping(
					parseManifest(
						readFileSync(join(versionDirectory, name), 'utf8'),
					),
				) ?? {}
			)
		} catch (error) {
			failures.push({
				file: join(versionDirectory, name),
				error: String(error),
			})
			return {}
		}
	}
	const versionFile = `${identifier}.yaml`
	if (!files.includes(versionFile)) return null
	const version = read(versionFile)
	const manifestType = text(version.ManifestType)
	if (manifestType === 'singleton')
		return { locale: version, locales: [], installer: version }
	if (manifestType !== 'version') return null
	const defaultLocale = text(version.DefaultLocale) || 'en-US'
	const localeFile = `${identifier}.locale.${defaultLocale}.yaml`
	const locale = files.includes(localeFile) ? read(localeFile) : {}
	const locales = files
		.filter(
			name =>
				name.startsWith(`${identifier}.locale.`) && name !== localeFile,
		)
		.map(read)
	const installerFile = `${identifier}.installer.yaml`
	const installer = files.includes(installerFile) ? read(installerFile) : {}
	return { locale, locales, installer }
}

export function collectInstallerFacts(installer) {
	const commands = new Set()
	const portableAliases = new Set()
	const families = new Set()
	const executables = new Set()
	const displayNames = new Set()
	const publishers = new Set()
	const visit = block => {
		for (const command of list(block.Commands)) commands.add(command)
		for (const family of list(block.PackageFamilyName)) families.add(family)
		for (const nested of mappings(block.NestedInstallerFiles)) {
			const file = basename(
				text(nested.RelativeFilePath).replace(/\\/g, '/'),
			)
			if (EXECUTABLE.test(file)) executables.add(file)
			const alias = text(nested.PortableCommandAlias)
			if (alias) portableAliases.add(alias)
		}
		for (const entry of mappings(block.AppsAndFeaturesEntries)) {
			const displayName = text(entry.DisplayName)
			if (displayName) displayNames.add(displayName)
			const publisher = text(entry.Publisher)
			if (publisher) publishers.add(publisher)
		}
	}
	visit(installer)
	for (const block of mappings(installer.Installers)) visit(block)
	return {
		commands: [...commands],
		portableAliases: [...portableAliases],
		families: [...families],
		executables: [...executables],
		displayNames: [...displayNames],
		publishers: [...publishers],
	}
}

export function packageFacts(identifier, version, manifests) {
	const { locale, locales, installer } = manifests
	return {
		identifier,
		version,
		name: text(locale.PackageName),
		publisher: text(locale.Publisher),
		moniker: text(locale.Moniker),
		localizedNames: locales
			.map(item => text(item.PackageName))
			.filter(Boolean),
		...collectInstallerFacts(installer),
	}
}

function* walkPackages(directory, depth) {
	let entries
	try {
		entries = readdirSync(directory)
	} catch {
		return
	}
	const versions = []
	const children = []
	for (const entry of entries) {
		if (entry.startsWith('.')) continue
		const full = join(directory, entry)
		if (!statSync(full).isDirectory()) continue
		const inner = readdirSync(full)
		const identifier = inner
			.map(name => /^(.+)\.yaml$/.exec(name)?.[1])
			.filter(Boolean)
			.map(name => name.replace(/\.(installer|locale\.[A-Za-z-]+)$/, ''))
			.find(Boolean)
		if (identifier && inner.includes(`${identifier}.yaml`))
			versions.push({ version: entry, path: full, identifier })
		else children.push(full)
	}
	if (versions.length > 0) {
		versions.sort((left, right) =>
			compareVersions(left.version, right.version),
		)
		const latest = versions[versions.length - 1]
		yield { ...latest, versionCount: versions.length }
	}
	if (depth < 6)
		for (const child of children) yield* walkPackages(child, depth + 1)
}

export class WingetSource {
	constructor(manifestsRoot) {
		this.name = 'winget-pkgs'
		this.root = manifestsRoot
		this.failures = []
	}

	*load() {
		for (const leaf of walkPackages(this.root, 0)) {
			const manifests = readManifests(
				leaf.path,
				leaf.identifier,
				this.failures,
			)
			if (!manifests) continue
			yield {
				...packageFacts(leaf.identifier, leaf.version, manifests),
				versionCount: leaf.versionCount,
			}
		}
	}
}
