export function middleEllipsis(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value
	if (maxLength <= 1) return '…'
	const leadingLength = Math.floor((maxLength - 1) / 2)
	const trailingLength = maxLength - 1 - leadingLength
	return `${value.slice(0, leadingLength)}…${value.slice(-trailingLength)}`
}
