import { MAX_SCENARIOS, type Scenario } from '../model/scenario.types'
import type {
	ScenarioImportChoice,
	ScenarioImportPreview,
} from '../model/scenarioImport.types'

export function mergeScenarioImport(
	existing: Scenario[],
	incoming: Scenario[],
	choices: ScenarioImportChoice[],
	idFactory: () => string,
): ScenarioImportPreview {
	const invalid = {
		ok: false as const,
		error: 'The scenario selection is no longer valid. Select it again.',
	}
	if (!choices.length || choices.length > MAX_SCENARIOS) return invalid
	const sources = new Map(incoming.map(item => [item.id, item]))
	const targets = new Map(existing.map(item => [item.id, item]))
	const selected = new Set<string>()
	const replaced = new Set<string>()
	for (const choice of choices) {
		if (!sources.has(choice.sourceId) || selected.has(choice.sourceId))
			return invalid
		selected.add(choice.sourceId)
		if (choice.replaceId !== null) {
			if (
				!targets.has(choice.replaceId) ||
				replaced.has(choice.replaceId)
			)
				return invalid
			replaced.add(choice.replaceId)
		}
	}
	if (existing.length + choices.length - replaced.size > MAX_SCENARIOS)
		return {
			ok: false,
			error: `At most ${MAX_SCENARIOS} scenarios can be saved.`,
		}
	const names = new Set(existing.map(item => item.name.toLocaleLowerCase()))
	const ids = new Set(existing.map(item => item.id))
	const additions: Scenario[] = []
	const replacements = new Map<string, Scenario>()
	for (const choice of choices) {
		const source = sources.get(choice.sourceId)!
		const target =
			choice.replaceId === null
				? undefined
				: targets.get(choice.replaceId)
		let id = target?.id ?? ''
		for (let attempt = 0; !id && attempt < 20; attempt++) {
			const candidate = idFactory()
			if (candidate && !ids.has(candidate)) id = candidate
		}
		if (!id)
			return {
				ok: false,
				error: 'A unique scenario ID could not be created. Try again.',
			}
		ids.add(id)
		let name = target?.name ?? source.name
		if (!target) {
			for (let suffix = 2; names.has(name.toLocaleLowerCase()); suffix++)
				name = `${source.name} (${suffix})`
			names.add(name.toLocaleLowerCase())
		}
		const imported = {
			...source,
			id,
			name,
			createdAt: target?.createdAt ?? Date.now(),
			lastRunAt: null,
		}
		if (target) replacements.set(target.id, imported)
		else additions.push(imported)
	}
	return {
		ok: true,
		scenarios: [
			...existing.map(item => replacements.get(item.id) ?? item),
			...additions,
		],
	}
}
