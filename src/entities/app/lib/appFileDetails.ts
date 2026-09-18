import { formatBytes } from '../../../shared/lib/bytes'
import { formatDate } from '../../../shared/lib/dates'
import type { AppDetails, AppInfo } from '../model/app.types'
import { displayVersion } from './appMetadata'

const NOT_AVAILABLE = 'Not available'

export function formatFileSize(bytes: number | null): string {
	if (bytes == null || !Number.isFinite(bytes) || bytes < 0)
		return NOT_AVAILABLE
	return formatBytes(bytes)
}

export function formatFileDate(unixSeconds: number | null): string {
	if (unixSeconds == null || !Number.isFinite(unixSeconds) || unixSeconds < 0)
		return NOT_AVAILABLE
	return formatDate(new Date(unixSeconds * 1000)) ?? NOT_AVAILABLE
}

function availabilityLabel(value: boolean | null): string {
	if (value == null) return NOT_AVAILABLE
	return value ? 'Yes' : 'No'
}

function signatureLabel(status: AppDetails['signature']): string {
	if (status === 'verified') return 'Verified'
	if (status === 'unsigned') return 'Unsigned'
	return NOT_AVAILABLE
}

function architectureLabel(architecture: AppDetails['architecture']): string {
	return architecture === 'notApplicable' ? 'Not applicable' : architecture
}

export function buildAppReport(
	app: AppInfo,
	details: AppDetails | null,
): string {
	const targetLabel =
		app.launchKind === 'app_user_model_id' ? 'Launch target' : 'Executable'
	const fileDetails = details ?? {
		fileSizeBytes: null,
		fileCreatedAt: null,
		fileModifiedAt: null,
		architecture: 'unknown' as const,
		signature: 'unavailable' as const,
		executableExists: null,
		installLocationExists: null,
	}
	return [
		'Application',
		`Name: ${app.name}`,
		`Publisher: ${app.publisher ?? NOT_AVAILABLE}`,
		`Version: ${app.version ? displayVersion(app.version) : NOT_AVAILABLE}`,
		`Category: ${app.category}`,
		'',
		'Installation',
		`Location: ${app.installLocation ?? NOT_AVAILABLE}`,
		`${targetLabel}: ${app.path}`,
		`${targetLabel} found: ${availabilityLabel(fileDetails.executableExists)}`,
		`Install location found: ${availabilityLabel(fileDetails.installLocationExists)}`,
		'',
		'File details',
		`Size: ${formatFileSize(fileDetails.fileSizeBytes)}`,
		`Created: ${formatFileDate(fileDetails.fileCreatedAt)}`,
		`Modified: ${formatFileDate(fileDetails.fileModifiedAt)}`,
		`Architecture: ${architectureLabel(fileDetails.architecture)}`,
		`Digital signature: ${signatureLabel(fileDetails.signature)}`,
	].join('\n')
}
