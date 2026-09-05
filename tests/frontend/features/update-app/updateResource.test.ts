import { describe, expect, it, vi } from 'vitest'
import {
	createUpdateResource,
	type UpdateHandle,
} from '../../../../src/features/update-app/model/updateResource'

function handle(): UpdateHandle {
	return {
		version: '0.5.1',
		rawJson: {},
		download: vi.fn(),
		install: vi.fn(),
		close: vi.fn().mockResolvedValue(undefined),
	}
}

describe('update resource leases', () => {
	it('discards an unselected result once even with duplicate cleanup', async () => {
		const resource = createUpdateResource(),
			update = handle()
		resource.discard(update)
		resource.discard(update)
		await Promise.resolve()
		expect(update.close).toHaveBeenCalledOnce()
	})
	it('holds an acquired resource until release after disposal', async () => {
		const resource = createUpdateResource(),
			update = handle()
		resource.replace(update)
		expect(resource.acquire()).toBe(update)
		expect(resource.acquire()).toBeNull()
		resource.replace(null)
		await Promise.resolve()
		expect(update.close).not.toHaveBeenCalled()
		resource.release(update)
		await Promise.resolve()
		expect(update.close).toHaveBeenCalledOnce()
	})
	it('retains the selected resource for retry when a lease finishes', async () => {
		const resource = createUpdateResource(),
			update = handle()
		resource.replace(update)
		resource.acquire()
		resource.release(update)
		await Promise.resolve()
		expect(update.close).not.toHaveBeenCalled()
		expect(resource.acquire()).toBe(update)
	})
})
