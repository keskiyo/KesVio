import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const cli = fileURLToPath(
	new URL('./frontend-import-graph.mjs', import.meta.url),
)

function check(files, options = {}) {
	const root = mkdtempSync(join(tmpdir(), 'kesvio-import-graph-'))
	try {
		const config = {
			compilerOptions: {
				moduleResolution: 'Bundler',
				module: 'ESNext',
				...options,
			},
			include: ['src'],
		}
		for (const [name, content] of Object.entries({
			'tsconfig.app.json': JSON.stringify(config),
			...files,
		})) {
			const target = join(root, name)
			mkdirSync(dirname(target), { recursive: true })
			writeFileSync(target, content)
		}
		const result = spawnSync(process.execPath, [cli, '--root', root], {
			encoding: 'utf8',
		})
		assert.ifError(result.error)
		return { status: result.status, output: result.stdout + result.stderr }
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
}

function rejects(files, diagnostic, options) {
	const result = check(files, options)
	assert.equal(result.status, 1, result.output)
	assert.match(result.output, diagnostic)
}

test('allows downward public APIs, same-slice internals, entity siblings and external packages', () => {
	const result = check({
		'src/app/main.tsx': `import { value } from '../features/launch-app/index.ts'; import 'react';`,
		'src/features/launch-app/index.ts': `export { value } from './model/value';`,
		'src/features/launch-app/model/value.ts': `export { value } from '../../../entities/app';`,
		'src/entities/app/index.ts': `export { value } from '../category/index';`,
		'src/entities/category/index.ts': `export { value } from '../../shared/lib/value.js';`,
		'src/shared/lib/value.ts': 'export const value = 1',
		'src/vite-env.d.ts': 'interface ImportMeta {}',
	})
	assert.equal(result.status, 0, result.output)
})

for (const source of [
	`import { value } from '../../app/value'`,
	`import { value } from "../../app/value"`,
	`import type { value } from '../../app/value'`,
	`import '../../app/value'`,
	`export { value } from '../../app/value'`,
	`export * from '../../app/value'`,
	`export type { value } from '../../app/value'`,
	`void import('../../app/value')`,
	'void import(`../../app/value`)',
	`type Value = import('../../app/value').value`,
	`import value = require('../../app/value')`,
]) {
	test(`rejects upward dependency: ${source}`, () => {
		rejects(
			{
				'src/shared/lib/value.ts': source,
				'src/app/value.ts': 'export const value = 1',
			},
			/src\/shared\/lib\/value\.ts:1:.*upward.*src\/app\/value\.ts/,
		)
	})
}

test('rejects sibling slices', () => {
	rejects(
		{
			'src/features/a/index.ts': `import '../b'`,
			'src/features/b/index.ts': '',
		},
		/sibling slice/,
	)
})

test('rejects internals reached from another layer or sibling entity', () => {
	for (const from of ['src/app/main.tsx', 'src/entities/category/index.ts']) {
		rejects(
			{
				[from]: `import '${from.includes('category') ? '..' : '../entities'}/app/api/types'`,
				'src/entities/app/api/types.ts': '',
			},
			/internals/,
		)
	}
})

test('allows only the exact launching subscription upward exception', () => {
	const target = { 'src/app/store/appStoreContext.ts': '' }
	const source = `import '../../../app/store/appStoreContext'`
	assert.equal(
		check({
			...target,
			'src/features/launch-app/model/useIsLaunching.ts': source,
		}).status,
		0,
	)
	rejects(
		{ ...target, 'src/features/launch-app/model/other.ts': source },
		/upward/,
	)
	rejects(
		{
			'src/app/store/types.ts': '',
			'src/features/launch-app/model/useIsLaunching.ts': `import '../../../app/store/types'`,
		},
		/upward/,
	)
})

test('concrete client wiring belongs only to main', () => {
	for (const client of ['app/api/appsClient', 'system/api/systemClient']) {
		const target = { [`src/entities/${client}.ts`]: '' }
		const source = `export * from '../entities/${client}'`
		assert.equal(check({ ...target, 'src/app/main.tsx': source }).status, 0)
		rejects({ ...target, 'src/app/other.ts': source }, /concrete client/)
	}
})

test('rejects cycles including type-only, re-export and dynamic edges', () => {
	rejects(
		{
			'src/shared/lib/a.ts': `export * from './b'`,
			'src/shared/lib/b.ts': `type A = import('./c').A`,
			'src/shared/lib/c.ts': `void import('./a')`,
		},
		/cycle.*src\/shared\/lib\/a\.ts.*src\/shared\/lib\/b\.ts.*src\/shared\/lib\/c\.ts/,
	)
})

test('rejects self-import cycles', () => {
	rejects(
		{ 'src/shared/lib/a.ts': `import './a'` },
		/cycle.*src\/shared\/lib\/a\.ts/,
	)
})

test('rejects unapproved top-level directories even without TypeScript', () => {
	rejects({ 'src/components/readme.md': '' }, /top-level.*src\/components/)
})

test('rejects index.ts outside a slice root', () => {
	for (const name of [
		'src/shared/ui/index.ts',
		'src/features/a/ui/index.ts',
		'src/app/index.ts',
	]) {
		rejects({ [name]: '' }, /index\.ts.*slice root/)
	}
})

test('rejects root source files except vite-env.d.ts', () => {
	rejects({ 'src/legacy.ts': '' }, /src\/legacy\.ts.*layer/)
})

test('resolves configured aliases but rejects them as non-relative internal imports', () => {
	rejects(
		{
			'src/app/main.tsx': `import '@local/value'`,
			'src/shared/lib/value.ts': '',
		},
		/relative.*@local\/value/,
		{ baseUrl: '.', paths: { '@local/*': ['src/shared/lib/*'] } },
	)
})

test('ignores import-shaped comments and strings', () => {
	assert.equal(
		check({
			'src/shared/lib/value.ts': `// import '../../app/value'\nconst text = "import '../../app/value'"`,
			'src/app/value.ts': '',
		}).status,
		0,
	)
})
