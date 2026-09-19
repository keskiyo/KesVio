// Downloads a winget-pkgs snapshot at one commit into the developer cache and pins it in
// data/search-aliases/winget.lock.json. Explicit developer action; never part of a build.
//
//   node scripts/search-aliases/update-source.mjs            -- pin current upstream master
//   node scripts/search-aliases/update-source.mjs <sha>      -- pin a specific commit
import { execFileSync } from 'node:child_process'
import {
	createWriteStream,
	existsSync,
	mkdirSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { GENERATOR_VERSION } from './lib/policy.mjs'
import { LOCK_PATH, cacheRoot } from './lib/snapshot.mjs'

const SOURCE = 'microsoft/winget-pkgs'
const ARCHIVE_ORIGIN = 'https://codeload.github.com'
const HEADERS = { 'User-Agent': 'kesvio-alias-generator' }

export function archiveUrl(commit) {
	if (!/^[0-9a-f]{40}$/.test(commit))
		throw new Error(`refusing non-commit ref ${commit}`)
	const url = new URL(`/${SOURCE}/tar.gz/${commit}`, ARCHIVE_ORIGIN)
	if (
		url.origin !== ARCHIVE_ORIGIN ||
		!url.pathname.startsWith(`/${SOURCE}/`)
	)
		throw new Error(`archive url left the expected repository: ${url.href}`)
	return url.href
}

async function resolveCommit(requested) {
	if (requested && /^[0-9a-f]{40}$/.test(requested)) return requested
	const response = await fetch(
		`https://api.github.com/repos/${SOURCE}/commits/${requested ?? 'master'}`,
		{ headers: HEADERS },
	)
	if (!response.ok) throw new Error(`GitHub API ${response.status}`)
	const body = await response.json()
	if (typeof body?.sha !== 'string' || !/^[0-9a-f]{40}$/.test(body.sha))
		throw new Error('GitHub API returned no commit sha')
	return body.sha
}

async function download(commit, target) {
	const response = await fetch(archiveUrl(commit), {
		headers: HEADERS,
		redirect: 'error',
	})
	if (!response.ok || !response.body)
		throw new Error(`codeload ${response.status}`)
	await pipeline(Readable.fromWeb(response.body), createWriteStream(target))
}

async function main() {
	const commit = await resolveCommit(process.argv[2])
	const root = cacheRoot()
	mkdirSync(root, { recursive: true })
	const archive = join(root, `${commit}.tar.gz`)
	const extracted = join(root, `winget-pkgs-${commit}`, 'manifests')
	if (!existsSync(extracted)) {
		if (!existsSync(archive) || statSync(archive).size < 50 * 1024 * 1024) {
			console.log(`downloading ${SOURCE}@${commit} …`)
			await download(commit, archive)
		}
		console.log('extracting manifests …')
		execFileSync(
			'tar',
			[
				'-xzf',
				archive,
				'-C',
				root,
				`winget-pkgs-${commit}/manifests`,
				`winget-pkgs-${commit}/LICENSE`,
			],
			{ stdio: 'inherit' },
		)
	}
	const lock = {
		source: SOURCE,
		license: 'MIT',
		commit,
		archive: archiveUrl(commit),
		generatorVersion: GENERATOR_VERSION,
		pinnedAt: new Date().toISOString().slice(0, 10),
	}
	mkdirSync(join(LOCK_PATH, '..'), { recursive: true })
	writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n')
	console.log(`pinned ${SOURCE}@${commit} → ${LOCK_PATH}`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
	main().catch(error => {
		console.error(error)
		process.exitCode = 1
	})
