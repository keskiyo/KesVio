import type { AppInfo } from '../model/app.types'
import type { CategoryDefinition } from '../../category'
import { queryTokenVariants } from '../../../shared/lib/searchQueryVariants'
import { fieldsFor } from './search/searchFields'
import { type QueryToken, scoreApp } from './search/scoring'

function queryTokens(query: string): QueryToken[] {
	return query
		.trim()
		.toLocaleLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.map(value => ({ value, variants: queryTokenVariants(value) }))
}

export function filterAppsByQuery(apps: AppInfo[], query: string): AppInfo[] {
	const tokens = queryTokens(query)
	if (tokens.length === 0) return apps
	return apps.filter(app => scoreApp(fieldsFor(app), tokens) > 0)
}

interface ScoredApp {
	app: AppInfo
	score: number
}

function compareRanked(left: ScoredApp, right: ScoredApp): number {
	return (
		right.score - left.score ||
		left.app.name.length - right.app.name.length ||
		left.app.name.localeCompare(right.app.name)
	)
}

export function rankAppsByQuery(apps: AppInfo[], query: string): AppInfo[] {
	const tokens = queryTokens(query)
	if (tokens.length === 0) return apps
	return apps
		.map(app => ({ app, score: scoreApp(fieldsFor(app), tokens) }))
		.filter(entry => entry.score > 0)
		.sort(compareRanked)
		.map(entry => entry.app)
}

export function rankAppsByQueryAndCategory(
	apps: AppInfo[],
	query: string,
	categories: CategoryDefinition[],
): AppInfo[] {
	const ranked = rankAppsByQuery(apps, query)
	const needle = query.trim().toLocaleLowerCase()
	if (!needle) return ranked
	const named = new Set(
		categories
			.filter(category =>
				category.label.toLocaleLowerCase().includes(needle),
			)
			.map(category => category.id),
	)
	if (named.size === 0) return ranked
	const alreadyRanked = new Set(ranked.map(app => app.id))
	return [
		...ranked,
		...apps.filter(
			app => named.has(app.category) && !alreadyRanked.has(app.id),
		),
	]
}

export function rankAppsByQueryTop(
	apps: AppInfo[],
	query: string,
	limit: number,
): AppInfo[] {
	if (limit <= 0) return []
	const tokens = queryTokens(query)
	if (tokens.length === 0) return apps.slice(0, limit)
	const top: ScoredApp[] = []
	for (const app of apps) {
		const score = scoreApp(fieldsFor(app), tokens)
		if (score === 0) continue
		const entry = { app, score }
		if (top.length === limit && compareRanked(entry, top[limit - 1]) >= 0)
			continue
		let low = 0
		let high = top.length
		while (low < high) {
			const middle = (low + high) >>> 1
			if (compareRanked(entry, top[middle]) < 0) high = middle
			else low = middle + 1
		}
		top.splice(low, 0, entry)
		if (top.length > limit) top.pop()
	}
	return top.map(entry => entry.app)
}
