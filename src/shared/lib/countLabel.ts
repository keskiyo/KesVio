const SIBILANT_ENDING = /(?:s|x|z|ch|sh)$/

export function countLabel(count: number, noun: string): string {
	if (count === 1) return `${count} ${noun}`
	return `${count} ${noun}${SIBILANT_ENDING.test(noun) ? 'es' : 's'}`
}
