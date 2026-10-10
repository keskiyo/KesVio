import { execFileSync } from 'node:child_process'
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..', '..')

export const defaults = {
	application: join(repoRoot, 'src-tauri', 'target', 'release', 'app.exe'),
	nativeDriver: join(
		repoRoot,
		'src-tauri',
		'target',
		'e2e',
		'msedgedriver.exe',
	),
}

const FIXTURES = [
	['Alpha', 'notepad.exe'],
	['Beta', 'charmap.exe'],
]

export function otherKesVioProcesses() {
	const output = execFileSync(
		'powershell',
		[
			'-NoProfile',
			'-Command',
			"Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -in @('KesVio','app') -and $_.Path } | ForEach-Object { $_.Path }",
		],
		{ encoding: 'utf8' },
	)
	return output
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean)
}

export function prepareWorkspace(application) {
	const stamp = new Date().toISOString().replace(/[:.]/g, '-')
	const root = join(tmpdir(), 'kesvio-e2e', stamp)
	const appDirectory = join(root, 'App')
	const dataDirectory = join(appDirectory, 'KesVioData', 'data')
	const fixtureDirectory = join(root, 'Fixtures', 'Portable')
	mkdirSync(dataDirectory, { recursive: true })
	mkdirSync(join(appDirectory, 'KesVioData', 'logs'), { recursive: true })
	const executable = join(appDirectory, basename(application))
	copyFileSync(application, executable)
	for (const [folder, source] of FIXTURES) {
		const target = join(fixtureDirectory, folder)
		mkdirSync(target, { recursive: true })
		copyFileSync(
			join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', source),
			join(target, `${folder}.exe`),
		)
	}
	writeFileSync(
		join(dataDirectory, 'scan-settings.json'),
		JSON.stringify({
			autoScanFixedDrives: false,
			includedPaths: [fixtureDirectory],
			excludedPaths: [],
			catalogTargetAvailabilityV1: true,
			catalogPortableFingerprintV1: true,
		}),
	)
	writeFileSync(
		join(dataDirectory, 'apps-cache.json'),
		'{"schemaVersion":11,"generation":0,"apps":[]}',
	)
	return {
		root,
		executable,
		environment: {
			WEBVIEW2_USER_DATA_FOLDER: join(root, 'WebView2'),
			LOCALAPPDATA: join(root, 'LocalAppData'),
		},
	}
}

export function folderStamp(path) {
	if (!existsSync(path)) return 'absent'
	let newest = 0
	const visit = directory => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const full = join(directory, entry.name)
			if (entry.isDirectory()) visit(full)
			else newest = Math.max(newest, statSync(full).mtimeMs)
		}
	}
	visit(path)
	return String(newest)
}

export function protectedFolders() {
	return [
		join(process.env.APPDATA ?? '', 'keskiyo.kesvio'),
		join(process.env.LOCALAPPDATA ?? '', 'keskiyo.kesvio'),
		join(process.env.LOCALAPPDATA ?? '', 'KesVio'),
	]
}
