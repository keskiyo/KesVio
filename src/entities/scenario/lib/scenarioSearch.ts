import type { AppInfo } from '../../app'
import {
	isWithinOneEdit,
	queryTokenVariants,
} from '../../../shared/lib/searchQueryVariants'
import type { Scenario } from '../model/scenario.types'
import {
	type ScenarioSearchFields,
	scenarioFieldsReader,
} from './scenarioSearchFields'

const MIN_FUZZY_LENGTH = 4

interface QueryToken {
	value: string
	variants: string[]
}

function directScore(fields: ScenarioSearchFields, token: string): number {
	if (fields.name === token) return 100
	if (fields.name.startsWith(token)) return 90
	if (
		fields.name.split(/[\s\-_.()[\]]+/).some(word => word.startsWith(token))
	)
		return 70
	if (fields.name.includes(token)) return 50
	if (fields.apps.includes(token)) return 25
	return 0
}

function tokenScore(fields: ScenarioSearchFields, token: QueryToken): number {
	for (let index = 0; index < token.variants.length; index += 1) {
		const score = directScore(fields, token.variants[index])
		if (score > 0) return score + (index === 0 ? 200 : 100)
	}
	if (token.value.length < MIN_FUZZY_LENGTH) return 0
	for (let index = 0; index < token.variants.length; index += 1)
		if (
			fields.words.some(word =>
				isWithinOneEdit(token.variants[index], word),
			)
		)
			return index === 0 ? 20 : 10
	return 0
}

function scoreScenario(
	fields: ScenarioSearchFields,
	tokens: QueryToken[],
): number {
	let total = 0
	for (const token of tokens) {
		const score = tokenScore(fields, token)
		if (score === 0) return 0
		total += score
	}
	return total
}

function queryTokens(query: string): QueryToken[] {
	return query
		.trim()
		.toLocaleLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.map(value => ({ value, variants: queryTokenVariants(value) }))
}

export function rankScenariosByQuery(
	scenarios: readonly Scenario[],
	apps: AppInfo[],
	query: string,
): Scenario[] {
	const tokens = queryTokens(query)
	if (tokens.length === 0) return [...scenarios]
	const fieldsOf = scenarioFieldsReader(apps)
	const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
	return scenarios
		.map(scenario => ({
			scenario,
			score: scoreScenario(fieldsOf(scenario), tokens),
		}))
		.filter(entry => entry.score > 0)
		.sort(
			(left, right) =>
				right.score - left.score ||
				collator.compare(left.scenario.name, right.scenario.name),
		)
		.map(entry => entry.scenario)
}
