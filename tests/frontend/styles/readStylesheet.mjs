import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function readStylesheet(path = 'src/app/styles/index.css') {
	return readFileSync(path, 'utf8').replace(
		/@import\s+['"](\.\/[^'"]+)['"];?/g,
		(_, imported) => readStylesheet(resolve(dirname(path), imported)),
	)
}
