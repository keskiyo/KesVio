import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const capabilities = JSON.parse(
	readFileSync('src-tauri/capabilities/default.json', 'utf8'),
)
const updaterHook = readFileSync(
	'src/features/update-app/model/useUpdater.ts',
	'utf8',
)
const updateCheck = readFileSync(
	'src/features/update-app/model/useUpdateCheck.ts',
	'utf8',
)
const updateInstall = readFileSync(
	'src/features/update-app/model/useUpdateInstall.ts',
	'utf8',
)

// The webview is untrusted, so a capability is an attack surface, not a convenience. `*:default`
// bundles every operation a plugin offers: `process:default` also grants `exit`, and
// `updater:default` grants `download-and-install`. The frontend uses neither.
describe('Tauri capabilities', () => {
	it('grants only the process and updater operations the frontend calls', () => {
		expect(capabilities.permissions).toEqual([
			'core:event:default',
			'core:window:default',
			'core:resources:default',
			'core:window:allow-start-dragging',
			'core:window:allow-minimize',
			'core:window:allow-toggle-maximize',
			'core:window:allow-close',
			'dialog:allow-open',
			'updater:allow-check',
			'updater:allow-download',
			'updater:allow-install',
			'process:allow-restart',
		])
	})

	it('does not grant a plugin default bundle', () => {
		const bundles = capabilities.permissions.filter(
			permission =>
				permission.endsWith(':default') &&
				!permission.startsWith('core:'),
		)

		expect(bundles).toEqual([])
	})

	// `core:default` also expands to `core:tray`, `core:menu`, `core:image` (including
	// `from-path`), `core:path` and `core:webview`: a compromised webview could create its own tray
	// icon, decode any image file on disk or resolve profile folders. The frontend calls none of them.
	it('grants only the core areas the frontend uses', () => {
		const core = capabilities.permissions.filter(permission =>
			permission.startsWith('core:'),
		)
		expect(core).not.toContain('core:default')
		for (const permission of core)
			expect(permission).toMatch(/^core:(event|window|resources):/)
	})

	it('keeps every direct Tauri import inside the areas the capability grants', () => {
		const sources = [
			'src/shared/api/tauri/client.ts',
			'src/shared/platform/window/useWindowControls.ts',
			'src/features/update-app/model/useUpdater.ts',
			'src/entities/system/api/systemClient.ts',
		].map(path => readFileSync(path, 'utf8'))
		const imported = sources.flatMap(source =>
			[...source.matchAll(/from '(@tauri-apps\/[^']+)'/g)].map(
				([, module]) => module,
			),
		)
		expect(new Set(imported)).toEqual(
			new Set([
				'@tauri-apps/api/core',
				'@tauri-apps/api/event',
				'@tauri-apps/api/window',
				'@tauri-apps/plugin-dialog',
				'@tauri-apps/plugin-process',
				'@tauri-apps/plugin-updater',
			]),
		)
	})

	// The grant and the call site have to move together: dropping a plugin call without dropping
	// its permission silently leaves the surface open.
	it('matches the updater operations the hook actually performs', () => {
		expect(updaterHook).toContain(
			'const checkForUpdate = () => check({ timeout: UPDATE_CHECK_TIMEOUT_MS })',
		)
		expect(updaterHook).toMatch(/useUpdateCheck\(\s*checkForUpdate,/)
		expect(updateCheck).toContain('.then(check)')
		expect(updaterHook).toContain('useUpdateInstall(resource, relaunch)')
		expect(updateInstall).toContain('.download(')
		expect(updateInstall).toContain('.install(')
		expect(updateInstall).toContain('relaunch()')
		// `exit` and the combined download-and-install are not used and are not granted.
		for (const source of [updaterHook, updateCheck, updateInstall]) {
			expect(source).not.toContain('downloadAndInstall')
			expect(source).not.toContain('exit(')
		}
	})
})
