import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ENTRY_BUDGET_BYTES = 600_000

export function entryScriptPath(indexHtml) {
	const match = indexHtml.match(
		/<script\b[^>]*type="module"[^>]*\bsrc="\/?([^"]+\.js)"/,
	)
	if (!match) throw new Error('dist/index.html names no module entry script.')
	return match[1]
}

export function checkEntryBudget(distDirectory, budget = ENTRY_BUDGET_BYTES) {
	const html = readFileSync(join(distDirectory, 'index.html'), 'utf8')
	const entry = entryScriptPath(html)
	const bytes = statSync(join(distDirectory, entry)).size
	return { entry, bytes, budget, ok: bytes <= budget }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
	const result = checkEntryBudget(resolve(process.argv[2] ?? 'dist'))
	const kilobytes = value => `${(value / 1000).toFixed(1)} kB`
	if (!result.ok) {
		console.error(
			`Entry chunk ${result.entry} is ${kilobytes(result.bytes)}, over the ${kilobytes(result.budget)} budget. Move rarely used code behind a lazy import before raising the budget.`,
		)
		process.exit(1)
	}
	console.log(
		`Entry chunk ${result.entry} is ${kilobytes(result.bytes)} of a ${kilobytes(result.budget)} budget`,
	)
}
