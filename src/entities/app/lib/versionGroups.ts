import type { AppInfo } from '../model/app.types'

export interface AppVersionGroup {
	primary: AppInfo
	older: AppInfo[]
}

const ARCHITECTURE_TOKEN = /\b(?:x64|x86|amd64|arm64|64-bit|32-bit)\b/g
const VERSION_TOKEN = /\bv?\d+(?:\.\d+)+\b/g
const INSTALLER_TOKEN = /\b(?:setup|installer|install)\b/g

function normalized(value: string | null | undefined): string {
	return (value ?? '')
		.toLowerCase()
		.replace(ARCHITECTURE_TOKEN, ' ')
		.replace(VERSION_TOKEN, ' ')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
}

function productKey(app: Pick<AppInfo, 'name' | 'publisher'>): string {
	return `${normalized(app.name).replace(INSTALLER_TOKEN, ' ').replace(/\s+/g, ' ').trim()}|${normalized(app.publisher)}`
}

function versionParts(version: string | null | undefined): number[] {
	return (version?.match(/\d+/g) ?? []).map(Number)
}

function compareVersions(
	left: string | null | undefined,
	right: string | null | undefined,
): number {
	const a = versionParts(left)
	const b = versionParts(right)
	for (let index = 0; index < Math.max(a.length, b.length); index++) {
		const difference = (a[index] ?? 0) - (b[index] ?? 0)
		if (difference !== 0) return Math.sign(difference)
	}
	return 0
}

export function groupAppVersions(apps: readonly AppInfo[]): AppVersionGroup[] {
	const groups = new Map<string, AppInfo[]>()
	for (const app of apps) {
		const key = productKey(app)
		const members = groups.get(key)
		if (members) members.push(app)
		else groups.set(key, [app])
	}
	const result: AppVersionGroup[] = []
	for (const members of groups.values()) {
		const [primary, ...older] = [...members].sort((a, b) =>
			compareVersions(b.version, a.version),
		)
		if (primary) result.push({ primary, older })
	}
	return result
}

export function newerInstalledVersions(
	installers: readonly AppInfo[],
	installed: readonly AppInfo[],
): Map<string, string> {
	const newestInstalled = new Map<string, string>()
	for (const app of installed) {
		if (!app.version || !app.publisher?.trim()) continue
		const key = productKey(app)
		const current = newestInstalled.get(key)
		if (!current || compareVersions(app.version, current) > 0)
			newestInstalled.set(key, app.version)
	}
	const newer = new Map<string, string>()
	for (const installer of installers) {
		if (!installer.version || !installer.publisher?.trim()) continue
		const version = newestInstalled.get(productKey(installer))
		if (version && compareVersions(version, installer.version) > 0)
			newer.set(installer.id, version)
	}
	return newer
}
