import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { checkEntryBudget, entryScriptPath } from './verify-bundle-budget.mjs'

function dist(entryBytes) {
	const root = mkdtempSync(join(tmpdir(), 'kesvio-budget-'))
	mkdirSync(join(root, 'assets'))
	writeFileSync(
		join(root, 'index.html'),
		'<script type="module" crossorigin src="/assets/index-abc.js"></script>',
	)
	writeFileSync(join(root, 'assets', 'index-abc.js'), 'x'.repeat(entryBytes))
	writeFileSync(
		join(root, 'assets', 'lazy-def.js'),
		'x'.repeat(entryBytes * 4),
	)
	return root
}

test('reads the module entry from the built page', () => {
	assert.equal(
		entryScriptPath(
			'<script type="module" src="/assets/index-1.js"></script>',
		),
		'assets/index-1.js',
	)
	assert.throws(() => entryScriptPath('<html></html>'))
})

test('measures only the entry chunk, never the lazy ones', () => {
	const root = dist(100)
	try {
		assert.deepEqual(checkEntryBudget(root, 100), {
			entry: 'assets/index-abc.js',
			bytes: 100,
			budget: 100,
			ok: true,
		})
		assert.equal(checkEntryBudget(root, 99).ok, false)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})
