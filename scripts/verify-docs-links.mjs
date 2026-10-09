// Fails when the shipped documentation points at something a reader cannot open.
//
// The technical record is a routing index plus the domain documents allow-listed in .gitignore,
// so the set is only useful while every link, every anchor and every quoted repository path
// resolves, and while nothing tracked sends a reader to a local working file that was never
// published. Those are the four failures this script reports.
//
// The git-ignored agent instructions and runbooks (AGENTS.md, CLAUDE.md, ReleaseInfo.md,
// info_build.md) are checked too, but only when they exist: a clean checkout and CI have none,
// so they never become a requirement. When present, their links, anchors, quoted paths, npm
// scripts and `Name.md §N` section references must still resolve.
//
//   node scripts/verify-docs-links.mjs [--root <project>]
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENTRY_DOCUMENTS = [
	'README.md',
	'Documentation.md',
	'CONTRIBUTING.md',
	'SECURITY.md',
	'PRIVACY.md',
	'THIRD_PARTY_NOTICES.md',
]
const LOCAL_INSTRUCTIONS = [
	{ name: 'AGENTS.md', roots: [''] },
	{ name: 'CLAUDE.md', roots: [''] },
	{ name: 'ReleaseInfo.md', roots: [''] },
	{ name: 'info_build.md', roots: [''] },
	{ name: 'src/AGENTS.md', roots: ['src', ''] },
	{ name: 'src/CLAUDE.md', roots: ['src', ''] },
	{ name: 'src-tauri/AGENTS.md', roots: ['src-tauri', 'src-tauri/src', ''] },
	{ name: 'src-tauri/CLAUDE.md', roots: ['src-tauri', ''] },
]
const LOCAL_PATH = /`([\w.-]+(?:\/[\w.@-]+)+\/?)`/g
const SECTION_REFERENCE = /`?([\w./-]+\.md)`?\s+§(\d+)/g
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const REPOSITORY_PATH =
	/`((?:src|src-tauri|scripts|tests|data|public|\.github)\/[^`\n]+)`/g
const NPM_SCRIPT = /`?npm run ([a-z][\w:-]*)/g
const EXTERNAL = /^(?:[a-z]+:|\/\/)/i
const BUILD_OUTPUT = /^(?:src-tauri\/target|dist|coverage)\//
const PLACEHOLDER = /[*<>|]|\.\.\.|…/

export function allowListedDocuments(root) {
	const ignore = readFileSync(join(root, '.gitignore'), 'utf8').split('\n')
	return ignore
		.map(line => /^!(docs\/[\w.-]+\.md)$/.exec(line.trim())?.[1])
		.filter(Boolean)
}

export function headingAnchors(markdown) {
	const anchors = new Set()
	for (const line of markdown.split('\n')) {
		const heading = /^#{1,6}\s+(.*?)\s*$/.exec(line)
		if (!heading) continue
		anchors.add(
			heading[1]
				.toLowerCase()
				.replace(/[`*_~]/g, '')
				.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
				.replace(/[^\p{L}\p{N}\s-]/gu, '')
				.trim()
				.replace(/\s+/g, '-'),
		)
	}
	return anchors
}

function ignoredPaths(root, candidates) {
	if (candidates.length === 0) return new Set()
	const result = spawnSync('git', ['check-ignore', '--stdin'], {
		cwd: root,
		input: `${candidates.join('\n')}\n`,
		encoding: 'utf8',
	})
	if (result.error) throw result.error
	if (result.status !== 0 && result.status !== 1)
		throw new Error(`git check-ignore exited with ${result.status}`)
	return new Set(
		result.stdout
			.split('\n')
			.map(line => line.trim().split('\\').join('/'))
			.filter(Boolean),
	)
}

function readDocuments(root, documents) {
	return documents
		.filter(name => existsSync(join(root, name)))
		.map(name => ({
			name,
			text: readFileSync(join(root, name), 'utf8'),
		}))
}

function numberedSections(markdown) {
	const sections = new Set()
	for (const line of markdown.split('\n')) {
		const heading = /^#{1,6}\s+(\d+)[.\s]/.exec(line)
		if (heading) sections.add(heading[1])
	}
	return sections
}

function firstExisting(root, bases, path) {
	for (const base of bases) {
		const full = resolve(root, base, path)
		if (existsSync(full)) return full
	}
	return null
}

function inspectLocalInstruction(root, { name, roots }, scripts) {
	const errors = []
	const text = readFileSync(join(root, name), 'utf8')
	const label = `${name} (local)`
	const documentDirectory = dirname(name)
	const bases = [...new Set([documentDirectory, ...roots])]

	for (const [, raw] of text.matchAll(LINK)) {
		if (EXTERNAL.test(raw)) continue
		const [target, anchor] = raw.split('#')
		const full = target
			? resolve(root, documentDirectory, decodeURIComponent(target))
			: join(root, name)
		if (!existsSync(full)) {
			errors.push(`${label}: link target does not exist — ${raw}`)
			continue
		}
		if (anchor && statSync(full).isFile()) {
			const known = headingAnchors(readFileSync(full, 'utf8'))
			if (!known.has(anchor.toLowerCase()))
				errors.push(
					`${label}: ${relative(root, full).split('\\').join('/')} has no heading for the anchor #${anchor}`,
				)
		}
	}

	for (const [, quoted] of text.matchAll(LOCAL_PATH)) {
		const candidate = quoted.replace(/[.,;:]+$/, '')
		if (PLACEHOLDER.test(candidate) || BUILD_OUTPUT.test(candidate))
			continue
		const firstSegment = candidate.split('/')[0]
		if (!firstExisting(root, bases, firstSegment)) continue
		if (!firstExisting(root, bases, candidate))
			errors.push(
				`${label}: quoted repository path does not exist — ${candidate}`,
			)
	}

	for (const [, document, section] of text.matchAll(SECTION_REFERENCE)) {
		const full = firstExisting(root, ['', documentDirectory], document)
		if (!full) {
			errors.push(
				`${label}: ${document} §${section} names a missing document`,
			)
			continue
		}
		if (!numberedSections(readFileSync(full, 'utf8')).has(section))
			errors.push(`${label}: ${document} has no section §${section}`)
	}

	for (const [, script] of text.matchAll(NPM_SCRIPT))
		if (!scripts.has(script))
			errors.push(
				`${label}: package.json has no script — npm run ${script}`,
			)

	return errors
}

export function inspect(root) {
	const shipped = allowListedDocuments(root)
	const documents = readDocuments(root, [...ENTRY_DOCUMENTS, ...shipped])
	const present = new Set(documents.map(document => document.name))
	const anchors = new Map(
		documents.map(document => [
			document.name,
			headingAnchors(document.text),
		]),
	)
	const scripts = new Set(
		Object.keys(
			JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
				.scripts ?? {},
		),
	)
	const errors = []
	const targets = []

	for (const { name, text } of documents) {
		for (const [, raw] of text.matchAll(LINK)) {
			if (EXTERNAL.test(raw)) continue
			const [target, anchor] = raw.split('#')
			if (!target) {
				if (anchor && !anchors.get(name).has(anchor.toLowerCase()))
					errors.push(`${name}: no heading for the anchor #${anchor}`)
				continue
			}
			const decoded = decodeURIComponent(target)
			const full = resolve(root, dirname(name), decoded)
			if (!existsSync(full)) {
				errors.push(`${name}: link target does not exist — ${raw}`)
				continue
			}
			const inside = relative(root, full).split('\\').join('/')
			if (inside.startsWith('..')) {
				errors.push(`${name}: link leaves the repository — ${raw}`)
				continue
			}
			targets.push({ name, raw, path: inside })
			if (anchor && statSync(full).isFile()) {
				const known =
					anchors.get(inside) ??
					headingAnchors(readFileSync(full, 'utf8'))
				if (!known.has(anchor.toLowerCase()))
					errors.push(
						`${name}: ${inside} has no heading for the anchor #${anchor}`,
					)
			}
		}

		for (const [, quoted] of text.matchAll(REPOSITORY_PATH)) {
			const candidate = quoted.split(/[\s,;)]/)[0].replace(/[.,;:]+$/, '')
			if (
				PLACEHOLDER.test(quoted) ||
				PLACEHOLDER.test(candidate) ||
				BUILD_OUTPUT.test(candidate)
			)
				continue
			if (!existsSync(join(root, candidate)))
				errors.push(
					`${name}: quoted repository path does not exist — ${candidate}`,
				)
		}

		for (const [, script] of text.matchAll(NPM_SCRIPT))
			if (!scripts.has(script))
				errors.push(
					`${name}: package.json has no script — npm run ${script}`,
				)
	}

	const ignored = ignoredPaths(root, [
		...new Set(targets.map(target => target.path)),
	])
	for (const { name, raw, path } of targets)
		if (ignored.has(path))
			errors.push(
				`${name}: links to a git-ignored path readers never receive — ${raw}`,
			)

	const index = documents.find(
		document => document.name === 'Documentation.md',
	)
	for (const document of shipped) {
		if (!present.has(document))
			errors.push(
				`.gitignore allow-lists a missing document — ${document}`,
			)
		else if (index && !index.text.includes(document))
			errors.push(`Documentation.md does not route to ${document}`)
	}

	const local = LOCAL_INSTRUCTIONS.filter(entry =>
		existsSync(join(root, entry.name)),
	)
	for (const entry of local)
		errors.push(...inspectLocalInstruction(root, entry, scripts))

	return {
		errors,
		documents: documents.length,
		links: targets.length,
		local: local.length,
	}
}

try {
	const args = process.argv.slice(2)
	if (args.length && (args.length !== 2 || args[0] !== '--root'))
		throw new Error(
			'Usage: node scripts/verify-docs-links.mjs [--root <project>]',
		)
	const root = args.length
		? resolve(args[1])
		: dirname(dirname(fileURLToPath(import.meta.url)))
	const { errors, documents, links, local } = inspect(root)
	if (errors.length) {
		process.stderr.write(`${errors.join('\n')}\n`)
		process.exitCode = 1
	} else {
		process.stdout.write(
			`Verified documentation: ${documents} documents, ${links} internal links, ${local} local instruction files\n`,
		)
	}
} catch (error) {
	process.stderr.write(
		`Documentation verification failed: ${error.message}\n`,
	)
	process.exitCode = 1
}
