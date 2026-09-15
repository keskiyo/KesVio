import {
	ADDED_WITHIN_CHOICES,
	AVAILABILITY_BUCKET_LABELS,
	AVAILABILITY_BUCKETS,
	SAVED_FILTER_SOURCES,
	SOURCE_LABELS,
	type AvailabilityBucket,
} from '../../../../entities/app'
import type { AppSourceKind } from '../../../../entities/app'

const FILTER_SOURCE_LABELS: Partial<Record<AppSourceKind, string>> = {
	steam: 'Steam (client and library games)',
	registry: 'Installed programs (registry)',
}

export const SOURCE_CHOICES: { value: AppSourceKind; label: string }[] =
	SAVED_FILTER_SOURCES.map(value => ({
		value,
		label: FILTER_SOURCE_LABELS[value] ?? SOURCE_LABELS[value],
	}))

export const SOURCE_HINT =
	'Where a record was discovered. Steam covers the client itself and the games of its library.'

export const AVAILABILITY_CHOICES: {
	value: AvailabilityBucket
	label: string
}[] = AVAILABILITY_BUCKETS.map(value => ({
	value,
	label: AVAILABILITY_BUCKET_LABELS[value],
}))

export const ADDED_WITHIN_OPTIONS: { value: number | null; label: string }[] = [
	{ value: null, label: 'Any time' },
	...ADDED_WITHIN_CHOICES.map(days => ({
		value: days,
		label: days === 1 ? 'Last day' : `Last ${days} days`,
	})),
]

export const FIELD_LABEL_CLASS =
	'text-xs font-semibold tracking-wide text-(--text-muted) uppercase'
