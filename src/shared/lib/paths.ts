export function parentFolderName(path: string): string | null {
	const segments = path
		.trim()
		.split(/[\\/]+/)
		.filter(Boolean)
	if (segments.length < 2) return null
	return segments[segments.length - 2] ?? null
}
