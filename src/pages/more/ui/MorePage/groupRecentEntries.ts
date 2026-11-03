import { formatPreviewDate } from './data'
import type { MorePreviewItem } from './types'

interface PublisherRun {
	publisher: string | null
	items: MorePreviewItem[]
}

interface DateGroup {
	date: string | null
	label: string
	runs: PublisherRun[]
}

export function groupRecentEntries(
	entries: MorePreviewItem[],
	now = new Date(),
): DateGroup[] {
	const today = formatPreviewDate(now.getTime())?.display
	const yesterday = new Date(now)
	yesterday.setDate(yesterday.getDate() - 1)
	const yesterdayLabel = formatPreviewDate(yesterday.getTime())?.display
	const groups: DateGroup[] = []
	for (const entry of entries) {
		const date = formatPreviewDate(entry.firstSeenAt)?.display ?? null
		let group = groups.at(-1)
		if (!group || group.date !== date) {
			group = {
				date,
				label:
					date === null
						? 'Date unknown'
						: date === today
							? 'Today'
							: date === yesterdayLabel
								? 'Yesterday'
								: date,
				runs: [],
			}
			groups.push(group)
		}
		const publisher = entry.app.publisher?.trim() || null
		let run = group.runs.at(-1)
		if (!run || run.publisher !== publisher) {
			run = { publisher, items: [] }
			group.runs.push(run)
		}
		run.items.push(entry)
	}
	return groups
}
