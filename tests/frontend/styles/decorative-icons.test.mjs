import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(directory, found = []) {
	for (const entry of readdirSync(directory)) {
		const full = join(directory, entry)
		if (statSync(full).isDirectory()) sourceFiles(full, found)
		else if (/\.tsx$/.test(entry)) found.push(full)
	}
	return found
}

/** Every `<Icon … />` element a file renders from its own lucide import, with its attributes. */
function iconElements(file) {
	const text = readFileSync(file, 'utf8')
	const statement = text.match(
		/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/s,
	)
	if (!statement) return []
	const names = statement[1]
		.split(',')
		.map(raw => raw.trim().replace(/^type\s+/, ''))
		.filter(name => name && name !== 'LucideIcon')
	const found = []
	for (const name of names) {
		for (const match of text.matchAll(
			new RegExp(`<${name}\\b([^>]*?)\\s*/>`, 'gs'),
		)) {
			const line = text.slice(0, match.index).split('\n').length
			found.push({ name, attributes: match[1], line })
		}
	}
	return found
}

/**
 * The accessible name of an icon button is its `aria-label`; the `<svg>` inside is decoration and
 * a screen reader that meets it without `aria-hidden` may announce an unnamed graphic between
 * the label and the next control. Nothing at runtime checks this, so the source tree is checked
 * instead: an icon rendered directly is either hidden or deliberately named.
 */
describe('decorative icons', () => {
	it('hides every directly rendered lucide icon from assistive technology unless it is named', () => {
		const exposed = []
		for (const file of sourceFiles('src'))
			for (const icon of iconElements(file))
				if (!/aria-hidden|aria-label|role=/.test(icon.attributes))
					exposed.push(
						`${relative(process.cwd(), file)}:${icon.line} <${icon.name}>`,
					)

		expect(exposed).toEqual([])
	})
})
