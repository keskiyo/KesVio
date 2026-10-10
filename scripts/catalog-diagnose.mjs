import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { diagnoseCatalog } from './catalog-diagnose/lib.mjs'

function parseArguments(argv) {
	let catalogPath
	const query = []
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === '--catalog') {
			catalogPath = argv[index + 1]
			if (!catalogPath) throw new Error('--catalog requires a path')
			index += 1
		} else {
			query.push(argv[index])
		}
	}
	if (query.length === 0)
		throw new Error(
			'usage: catalog:diagnose -- [--catalog <path>] "app name"',
		)
	return { catalogPath, query: query.join(' ') }
}

function main() {
	const { catalogPath, query } = parseArguments(process.argv.slice(2))
	const file =
		catalogPath ??
		join(process.env.APPDATA ?? '', 'keskiyo.kesvio', 'apps-cache.json')
	if (!existsSync(file)) throw new Error(`no catalog at ${file}`)
	const catalog = JSON.parse(readFileSync(file, 'utf8'))
	console.log(diagnoseCatalog(catalog, query))
}

if (
	process.argv[1] &&
	pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
	try {
		main()
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	}
}
