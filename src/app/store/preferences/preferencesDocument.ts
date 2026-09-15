import { DEFAULT_PREFERENCES } from './preferencesSchema'

export function parseStoredPreferences(
	source: string,
): Record<string, unknown> | null {
	try {
		const value: unknown = JSON.parse(source)
		if (!value || typeof value !== 'object' || Array.isArray(value))
			return null
		const raw = value as Record<string, unknown>
		if ('version' in raw) {
			return typeof raw.version === 'number' &&
				Number.isSafeInteger(raw.version) &&
				raw.version >= 1
				? raw
				: null
		}
		const recognized = Object.entries(DEFAULT_PREFERENCES).some(
			([key, fallback]) => {
				if (key === 'version' || !(key in raw)) return false
				const field = raw[key]
				if (Array.isArray(fallback)) return Array.isArray(field)
				if (fallback && typeof fallback === 'object')
					return (
						!!field &&
						typeof field === 'object' &&
						!Array.isArray(field)
					)
				return typeof field === typeof fallback
			},
		)
		return recognized ? raw : null
	} catch {
		return null
	}
}
