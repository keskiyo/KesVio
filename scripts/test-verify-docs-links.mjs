import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const cli = fileURLToPath(new URL('./verify-docs-links.mjs', import.meta.url))

const GITIGNORE = [
	'docs/*',
	'!docs/architecture.md',
	'.1localDocuments/',
	'',
].join('\n')
const INDEX = [
	'# KesVio Technical Documentation',
	'',
	'| Changing | Read |',
	'| --- | --- |',
	'| layers | [Architecture](docs/architecture.md) |',
	'',
].join('\n')
const ARCHITECTURE = [
	'# Architecture',
	'',
	'## Layers',
	'',
	'Frontend.',
	'',
].join('\n')

function check(files) {
	const root = mkdtempSync(join(tmpdir(), 'kesvio-docs-links-'))
	try {
		const contents = {
			'.gitignore': GITIGNORE,
			'package.json': JSON.stringify({ scripts: { test: 'vitest run' } }),
			'Documentation.md': INDEX,
			'docs/architecture.md': ARCHITECTURE,
			...files,
		}
		for (const [name, content] of Object.entries(contents)) {
			const target = join(root, name)
			mkdirSync(dirname(target), { recursive: true })
			writeFileSync(target, content)
		}
		spawnSync('git', ['init', '--quiet'], { cwd: root })
		const result = spawnSync(process.execPath, [cli, '--root', root], {
			encoding: 'utf8',
		})
		assert.ifError(result.error)
		return { status: result.status, output: result.stdout + result.stderr }
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
}

function rejects(files, diagnostic) {
	const result = check(files)
	assert.equal(result.status, 1, result.output)
	assert.match(result.output, diagnostic)
}

test('accepts a documentation set whose links, anchors and paths resolve', () => {
	const result = check({
		'README.md': [
			'# KesVio',
			'',
			'See [Documentation](Documentation.md) and [layers](docs/architecture.md#layers).',
			'The entry point is `package.json`; run `npm test`.',
			'',
		].join('\n'),
	})
	assert.equal(result.status, 0, result.output)
	assert.match(
		result.output,
		/Verified documentation: \d+ documents, \d+ internal links/,
	)
})

test('rejects a link whose target does not exist', () => {
	rejects(
		{ 'README.md': 'See [gone](docs/gone.md).\n' },
		/README\.md: link target does not exist/,
	)
})

test('rejects an anchor no heading produces', () => {
	rejects(
		{ 'README.md': 'See [layers](docs/architecture.md#invented).\n' },
		/architecture\.md has no heading for the anchor #invented/,
	)
})

test('rejects an anchor missing inside the same document', () => {
	rejects(
		{ 'README.md': '# KesVio\n\nSee [below](#nowhere).\n' },
		/README\.md: no heading for the anchor #nowhere/,
	)
})

test('rejects a link to a path readers never receive', () => {
	rejects(
		{
			'README.md': 'See [the plan](.1localDocuments/plan.md).\n',
			'.1localDocuments/plan.md': '# Plan\n',
		},
		/links to a git-ignored path/,
	)
})

test('rejects a quoted repository path that does not exist', () => {
	rejects(
		{ 'README.md': 'Edit `src/entities/app/lib/gone.ts` to change it.\n' },
		/quoted repository path does not exist — src\/entities\/app\/lib\/gone\.ts/,
	)
})

test('accepts a quoted build output path that only exists after a build', () => {
	const result = check({
		'README.md':
			'The installer lands in `src-tauri/target/release/KesVio.exe`.\n',
	})
	assert.equal(result.status, 0, result.output)
})

test('accepts a quoted placeholder that stands for a family of paths', () => {
	const result = check({
		'README.md': [
			'Anything under `src/…`, `tests/...` or `scripts/verify-*.ps1` is a placeholder.',
			'',
		].join('\n'),
	})
	assert.equal(result.status, 0, result.output)
})

test('rejects a command package.json does not define', () => {
	rejects(
		{ 'README.md': 'Run `npm run invented` first.\n' },
		/package\.json has no script — npm run invented/,
	)
})

test('rejects an allow-listed document the index does not route to', () => {
	rejects(
		{
			'.gitignore': `${GITIGNORE}!docs/catalog.md\n`,
			'docs/catalog.md': '# Catalog\n',
		},
		/Documentation\.md does not route to docs\/catalog\.md/,
	)
})

test('rejects an allow-listed document that is missing from the tree', () => {
	rejects(
		{ '.gitignore': `${GITIGNORE}!docs/catalog.md\n` },
		/allow-lists a missing document — docs\/catalog\.md/,
	)
})
