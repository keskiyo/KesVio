interface OrderedScenario {
	name: string
	createdAt: number | null
	lastRunAt?: number | null
}

export function sortScenariosByNewest<T extends { createdAt: number | null }>(
	scenarios: readonly T[],
): T[] {
	return [...scenarios].sort(
		(left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0),
	)
}

export function sortScenariosByName<T extends { name: string }>(
	scenarios: readonly T[],
): T[] {
	const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
	return [...scenarios].sort((left, right) =>
		collator.compare(left.name, right.name),
	)
}

export function sortScenariosByRecency<T extends OrderedScenario>(
	scenarios: readonly T[],
): T[] {
	const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
	return [...scenarios].sort(
		(left, right) =>
			(right.lastRunAt ?? 0) - (left.lastRunAt ?? 0) ||
			(right.createdAt ?? 0) - (left.createdAt ?? 0) ||
			collator.compare(left.name, right.name),
	)
}
