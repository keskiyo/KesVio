export function joinHydrationIds(ids: Iterable<string>): string {
	return JSON.stringify([...new Set(ids)].filter(Boolean))
}

export function splitHydrationIds(value: string): string[] {
	if (!value) return []
	try {
		const ids: unknown = JSON.parse(value)
		return Array.isArray(ids)
			? ids.filter(
					(id): id is string =>
						typeof id === 'string' && id.length > 0,
				)
			: []
	} catch {
		return []
	}
}
