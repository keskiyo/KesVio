const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeZone: 'UTC',
})

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeStyle: 'short',
})

function valid(date: Date): boolean {
	return !Number.isNaN(date.getTime())
}

export function formatDate(date: Date): string | null {
	return valid(date) ? DATE_FORMAT.format(date) : null
}

export function formatDateTime(date: Date): string | null {
	return valid(date) ? DATE_TIME_FORMAT.format(date) : null
}
