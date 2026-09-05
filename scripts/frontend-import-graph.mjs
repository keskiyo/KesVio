import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findCycles } from './frontend-import-graph-cycles.mjs'
import { inspectEdge, inspectLayout } from './frontend-import-graph-rules.mjs'
import {
	collectFiles,
	readCompilerOptions,
	readImports,
	relativePath,
	resolveImport,
	sourceExtension,
} from './frontend-import-graph-source.mjs'

function inspect(root) {
	const files = collectFiles(join(root, 'src'))
	const errors = inspectLayout(root, files)
	const options = readCompilerOptions(root)
	const graph = new Map()
	for (const file of files.filter(file => sourceExtension.test(file))) {
		const from = relativePath(root, file)
		const edges = new Set()
		graph.set(from, edges)
		for (const { specifier, line, column } of readImports(file)) {
			const resolved = resolveImport(specifier, file, options)
			if (!resolved) continue
			const to = relativePath(root, resolved)
			if (!to.startsWith('src/')) continue
			edges.add(to)
			errors.push(
				...inspectEdge(from, to, specifier).map(
					error => `${from}:${line}:${column}: ${error}`,
				),
			)
		}
	}
	for (const cycle of findCycles(graph))
		errors.push(
			`Dependency cycle (strongly connected files): ${cycle.join(', ')}`,
		)
	return errors
}

try {
	const args = process.argv.slice(2)
	if (args.length && (args.length !== 2 || args[0] !== '--root'))
		throw new Error(
			'Usage: node scripts/frontend-import-graph.mjs [--root <project>]',
		)
	const root = args.length
		? resolve(args[1])
		: dirname(dirname(fileURLToPath(import.meta.url)))
	const errors = inspect(root)
	if (errors.length) {
		process.stderr.write(`${errors.join('\n')}\n`)
		process.exitCode = 1
	} else {
		process.stdout.write('Verified frontend import graph\n')
	}
} catch (error) {
	process.stderr.write(`Frontend import graph failed: ${error.message}\n`)
	process.exitCode = 1
}
