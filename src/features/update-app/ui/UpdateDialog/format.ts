import { formatDate } from '../../../../shared/lib/dates'

export function formatReleaseDate(value: string): string | null {
	return formatDate(new Date(value))
}
