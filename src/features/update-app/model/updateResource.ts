export type UpdateDownloadEvent =
	| { event: 'Started'; data: { contentLength?: number } }
	| { event: 'Progress'; data: { chunkLength: number } }
	| { event: 'Finished' }

export interface UpdateHandle {
	version: string
	body?: string
	date?: string
	rawJson: Record<string, unknown>
	download(onEvent: (event: UpdateDownloadEvent) => void): Promise<void>
	install(): Promise<void>
	close(): Promise<void>
}

export function createUpdateResource() {
	let current: UpdateHandle | null = null
	const retained = new Set<UpdateHandle>()
	const closed = new WeakSet<UpdateHandle>()
	const discard = (update: UpdateHandle | null) => {
		if (
			!update ||
			update === current ||
			retained.has(update) ||
			closed.has(update)
		)
			return
		closed.add(update)
		void Promise.resolve()
			.then(() => update.close())
			.catch(() => undefined)
	}
	return {
		get: () => current,
		replace(update: UpdateHandle | null) {
			const previous = current
			current = update
			discard(previous)
		},
		discard,
		acquire() {
			if (!current || closed.has(current) || retained.has(current))
				return null
			retained.add(current)
			return current
		},
		release(update: UpdateHandle) {
			retained.delete(update)
			discard(update)
		},
	}
}

export type UpdateResource = ReturnType<typeof createUpdateResource>
