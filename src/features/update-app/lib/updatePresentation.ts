import type { AvailableUpdate, UpdateInstallPhase } from '../types'
import type { UpdateHandle } from '../model/updateResource'

const ACTIVE_UPDATE_PHASES = new Set<UpdateInstallPhase>([
	'downloading',
	'verifying',
	'installing',
	'restarting',
])

export function isUpdateInstalling(phase: UpdateInstallPhase): boolean {
	return ACTIVE_UPDATE_PHASES.has(phase)
}

function positiveNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? value
		: null
}

function httpUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null
	try {
		const url = new URL(value)
		return url.protocol === 'https:' ? url.toString() : null
	} catch {
		return null
	}
}

export function updateErrorMessage(error: unknown): string {
	const reason = error instanceof Error ? error.message : String(error)
	const normalized = reason.toLowerCase()
	if (normalized.includes('404') || normalized.includes('not found')) {
		return 'The update package is unavailable. Try again later or download it from GitHub.'
	}
	if (
		normalized.includes('download') ||
		normalized.includes('network') ||
		normalized.includes('request')
	) {
		return 'Could not download the update. Check your connection and try again.'
	}
	if (normalized.includes('signature') || normalized.includes('verify')) {
		return 'Update verification failed. The package was not installed.'
	}
	if (
		normalized.includes('access is denied') ||
		normalized.includes('permission') ||
		normalized.includes('administrator') ||
		normalized.includes('run as admin')
	) {
		return 'The update could not write the new version. Reinstall KesVio for the current user or download the installer manually.'
	}
	return 'The update could not be installed. Try again or download it manually.'
}

export function updatePresentation(
	update: UpdateHandle | null,
): AvailableUpdate | null {
	if (!update) return null
	return {
		version: update.version,
		notes: update.body ?? null,
		date: update.date ?? null,
		packageSize: positiveNumber(update.rawJson.packageSize),
		releaseUrl: httpUrl(update.rawJson.releaseUrl),
	}
}
