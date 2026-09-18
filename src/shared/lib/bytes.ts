const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
	let value = bytes
	let unitIndex = 0
	while (value >= 1024 && unitIndex < UNITS.length - 1) {
		value /= 1024
		unitIndex += 1
	}
	const formatted =
		unitIndex === 0 ? String(value) : Number(value.toFixed(1)).toString()
	return `${formatted} ${UNITS[unitIndex]}`
}
