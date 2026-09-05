export function findCycles(graph) {
	const indices = new Map()
	const lowlinks = new Map()
	const stack = []
	const pending = new Set()
	const cycles = []
	let nextIndex = 0

	function visit(file) {
		indices.set(file, nextIndex)
		lowlinks.set(file, nextIndex++)
		stack.push(file)
		pending.add(file)
		for (const target of graph.get(file) ?? []) {
			if (!indices.has(target)) {
				visit(target)
				lowlinks.set(
					file,
					Math.min(lowlinks.get(file), lowlinks.get(target)),
				)
			} else if (pending.has(target)) {
				lowlinks.set(
					file,
					Math.min(lowlinks.get(file), indices.get(target)),
				)
			}
		}
		if (lowlinks.get(file) !== indices.get(file)) return
		const component = []
		let member
		do {
			member = stack.pop()
			pending.delete(member)
			component.push(member)
		} while (member !== file)
		if (component.length > 1 || graph.get(file)?.has(file))
			cycles.push(component.sort())
	}

	for (const file of graph.keys()) if (!indices.has(file)) visit(file)
	return cycles.sort((left, right) => left[0].localeCompare(right[0]))
}
