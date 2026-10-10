function normalize(value) {
	return String(value ?? '')
		.normalize('NFKC')
		.toLocaleLowerCase()
		.replaceAll('/', '\\')
		.replace(/\s+/g, ' ')
		.trim()
}

function targetOf(app) {
	return normalize(app.resolvedPath || app.path)
}

function searchableText(app) {
	return normalize(
		[
			app.name,
			app.productName,
			app.publisher,
			app.originalFilename,
			app.path,
			app.resolvedPath,
			app.launchArguments,
		]
			.filter(Boolean)
			.join(' '),
	)
}

function matchesQuery(app, query) {
	const tokens = normalize(query).split(' ').filter(Boolean)
	const text = searchableText(app)
	return tokens.length > 0 && tokens.every(token => text.includes(token))
}

function sourceEntries(catalog) {
	return catalog.sources.flatMap(source =>
		source.apps.map(app => ({ app, source: source.key })),
	)
}

function sortEntries(entries) {
	return entries.toSorted((left, right) =>
		`${left.source}\u0001${left.app.name}\u0001${left.app.path}`.localeCompare(
			`${right.source}\u0001${right.app.name}\u0001${right.app.path}`,
		),
	)
}

function argumentsLabel(app) {
	return app.launchArguments?.trim() || '(none)'
}

function discoveryLines(entries) {
	const lines = [`Discovery (${entries.length})`]
	for (const { app, source } of sortEntries(entries)) {
		lines.push(`- [${source}] ${app.name}`)
		lines.push(`  target: ${app.resolvedPath || app.path}`)
		lines.push(`  path: ${app.path}`)
		lines.push(`  arguments: ${argumentsLabel(app)}`)
		lines.push(
			`  classification: ${app.artifactKind ?? 'unknown'} / ${app.category ?? 'unknown'}`,
		)
	}
	return lines
}

function finalLines(apps, query) {
	const lines = [`Final catalog (${apps.length})`]
	for (const app of apps.toSorted((left, right) =>
		left.name.localeCompare(right.name),
	)) {
		lines.push(`- winner: ${app.name}`)
		lines.push(`  target: ${app.resolvedPath || app.path}`)
		lines.push(`  path: ${app.path}`)
		lines.push(`  arguments: ${argumentsLabel(app)}`)
		lines.push(`  category: ${app.category ?? 'unknown'}`)
		lines.push(
			`  visibility: ${app.visibilityClass ?? 'unknown'}${app.visibilityReasons?.length ? ` (${app.visibilityReasons.join(', ')})` : ''}`,
		)
		lines.push(`  query match: ${matchesQuery(app, query) ? 'yes' : 'no'}`)
	}
	return lines
}

function validateCatalog(catalog) {
	if (!catalog || typeof catalog !== 'object')
		throw new Error('catalog root must be an object')
	if (!Array.isArray(catalog.apps))
		throw new Error('catalog.apps must be an array')
	if (!Array.isArray(catalog.sources))
		throw new Error('catalog.sources must be an array')
	for (const source of catalog.sources)
		if (typeof source?.key !== 'string' || !Array.isArray(source.apps))
			throw new Error(
				'every catalog source must have a key and apps array',
			)
}

export function diagnoseCatalog(catalog, query) {
	validateCatalog(catalog)
	if (!normalize(query)) throw new Error('query must not be empty')
	const allSources = sourceEntries(catalog)
	const seeds = allSources.filter(({ app }) => matchesQuery(app, query))
	const targets = new Set(
		seeds.map(({ app }) => targetOf(app)).filter(Boolean),
	)
	const discovered = allSources.filter(
		({ app }) => matchesQuery(app, query) || targets.has(targetOf(app)),
	)
	const final = catalog.apps.filter(
		app => matchesQuery(app, query) || targets.has(targetOf(app)),
	)
	const directFinal = final.filter(app => matchesQuery(app, query))
	const result = directFinal.length
		? 'FOUND'
		: final.length
			? 'FINAL_NAME_MISMATCH'
			: discovered.length
				? 'LOST_AFTER_DISCOVERY'
				: 'NOT_DISCOVERED'
	return [
		`Query: ${query}`,
		`Schema: ${catalog.schemaVersion ?? 'unknown'}`,
		'',
		...discoveryLines(discovered),
		'',
		...finalLines(final, query),
		'',
		`result: ${result}`,
	].join('\n')
}
