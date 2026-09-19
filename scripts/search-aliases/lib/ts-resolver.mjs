import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RELATIVE = /^\.\.?\//
const HAS_EXTENSION = /\.[a-z]+$/i

export async function resolve(specifier, context, nextResolve) {
	if (
		RELATIVE.test(specifier) &&
		!HAS_EXTENSION.test(specifier) &&
		context.parentURL
	) {
		const base = new URL(specifier, context.parentURL)
		for (const candidate of [`${base.href}.ts`, `${base.href}/index.ts`]) {
			if (existsSync(fileURLToPath(candidate)))
				return nextResolve(
					pathToFileURL(fileURLToPath(candidate)).href,
					context,
				)
		}
	}
	return nextResolve(specifier, context)
}
