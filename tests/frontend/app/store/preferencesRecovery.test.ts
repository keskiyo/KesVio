import { describe, expect, it } from 'vitest'
import {
	DEFAULT_PREFERENCES,
	PREFERENCES_BACKUP_KEY,
	PREFERENCES_KEY,
	readPreferences,
	serializePreferences,
	writePreferences,
} from '../../../../src/app/store/preferences'

function storageWith(primary: string, backup: string) {
	const values = new Map([
		[PREFERENCES_KEY, primary],
		[PREFERENCES_BACKUP_KEY, backup],
	])
	let rejectedKey: string | null = null
	const storage: Storage = {
		get length() {
			return values.size
		},
		clear: () => values.clear(),
		key: index => [...values.keys()][index] ?? null,
		removeItem: key => {
			values.delete(key)
		},
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => {
			if (key === rejectedKey) throw new Error('Storage write denied')
			values.set(key, value)
		},
	}
	return {
		storage,
		values,
		reject: (key: string) => {
			rejectedKey = key
		},
	}
}

const saved = serializePreferences({
	...DEFAULT_PREFERENCES,
	favoriteAppIds: ['keep'],
	hiddenAppIds: ['hidden'],
	unknownFields: { futureOption: 'preserve' },
})

describe('preference recovery lifecycle', () => {
	it.each(['null', '[]', '42', '{}', '{broken', '{"version":"19"}'])(
		'recovers a valid backup behind invalid primary %s',
		primary => {
			const { storage } = storageWith(primary, saved)
			expect(readPreferences(storage).favoriteAppIds).toEqual(['keep'])
		},
	)

	it('keeps the recovered backup when the next primary write fails', () => {
		const { storage, values, reject } = storageWith('{broken', saved)
		const recovered = readPreferences(storage)
		reject(PREFERENCES_KEY)
		expect(writePreferences(storage, recovered)).toBe(false)
		expect(values.get(PREFERENCES_BACKUP_KEY)).toBe(saved)
		expect(readPreferences(storage)).toEqual(recovered)
	})

	it('keeps the recovered backup after a successful write and later corruption', () => {
		const { storage, values } = storageWith('{broken', saved)
		expect(writePreferences(storage, readPreferences(storage))).toBe(true)
		values.set(PREFERENCES_KEY, '{broken-again')
		expect(readPreferences(storage).favoriteAppIds).toEqual(['keep'])
	})

	it('retains the previous backup when reading the primary is denied', () => {
		const { storage, values } = storageWith(saved, saved)
		storage.getItem = key => {
			if (key === PREFERENCES_KEY) throw new Error('Storage read denied')
			return values.get(key) ?? null
		}
		expect(readPreferences(storage).favoriteAppIds).toEqual(['keep'])
		expect(writePreferences(storage, DEFAULT_PREFERENCES)).toBe(false)
		expect(values.get(PREFERENCES_KEY)).toBe(saved)
	})

	it('preserves legacy unversioned marks through load and rotation', () => {
		const legacy = JSON.stringify({ favoriteAppIds: ['legacy'] })
		const { storage, values } = storageWith(legacy, saved)
		expect(readPreferences(storage).favoriteAppIds).toEqual(['legacy'])
		expect(writePreferences(storage, readPreferences(storage))).toBe(true)
		expect(values.get(PREFERENCES_BACKUP_KEY)).toBe(legacy)
	})

	it('keeps primary readable when backup rotation is denied', () => {
		const { storage, reject } = storageWith(saved, saved)
		reject(PREFERENCES_BACKUP_KEY)
		writePreferences(storage, {
			...DEFAULT_PREFERENCES,
			favoriteAppIds: ['new'],
		})
		expect(readPreferences(storage).favoriteAppIds).toEqual(['new'])
	})
})
