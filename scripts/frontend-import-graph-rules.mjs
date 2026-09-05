import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
	relativePath,
	sourceExtension,
} from './frontend-import-graph-source.mjs'

const layers = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']
const sliced = new Set(['entities', 'features', 'widgets', 'pages'])
const clients = new Set([
	'src/entities/app/api/appsClient.ts',
	'src/entities/system/api/systemClient.ts',
])

export function inspectLayout(root, files) {
	const errors = []
	for (const entry of readdirSync(join(root, 'src'), {
		withFileTypes: true,
	})) {
		if (entry.isDirectory() && !layers.includes(entry.name))
			errors.push(`Unapproved top-level directory: src/${entry.name}`)
	}
	for (const file of files) {
		const name = relativePath(root, file)
		const parts = name.split('/')
		if (!sourceExtension.test(name) || name === 'src/vite-env.d.ts')
			continue
		if (!layers.includes(parts[1]) || parts.length < 3)
			errors.push(`${name}: source must belong to an approved layer`)
		if (
			parts.at(-1) === 'index.ts' &&
			!(sliced.has(parts[1]) && parts.length === 4)
		)
			errors.push(`${name}: index.ts is allowed only at a slice root`)
	}
	return errors
}

export function inspectEdge(from, to, specifier) {
	const errors = []
	if (!specifier.startsWith('./') && !specifier.startsWith('../'))
		errors.push(`internal imports must be relative (${specifier})`)
	if (clients.has(to) && from !== 'src/app/main.tsx')
		errors.push(
			`only src/app/main.tsx may import a concrete client (${to})`,
		)
	if (
		from === 'src/features/launch-app/model/useIsLaunching.ts' &&
		to === 'src/app/store/appStoreContext.ts'
	)
		return errors
	const [, fromLayer, fromSlice] = from.split('/')
	const [, toLayer, toSlice] = to.split('/')
	if (layers.indexOf(toLayer) > layers.indexOf(fromLayer))
		errors.push(`imports upward into '${toLayer}' (${to})`)
	if (
		!sliced.has(toLayer) ||
		(fromLayer === toLayer && fromSlice === toSlice)
	)
		return errors
	if (fromLayer === toLayer && fromLayer !== 'entities')
		errors.push(`imports sibling slice '${toLayer}/${toSlice}' (${to})`)
	if (from === 'src/app/main.tsx' && clients.has(to)) return errors
	if (to !== `src/${toLayer}/${toSlice}/index.ts`)
		errors.push(`reaches into '${toLayer}/${toSlice}' internals (${to})`)
	return errors
}
