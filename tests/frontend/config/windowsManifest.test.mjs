import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = readFileSync('src-tauri/windows-app-manifest.xml', 'utf8')
const buildScript = readFileSync('src-tauri/build.rs', 'utf8')

// Tauri's default manifest carries only the Common Controls dependency, so KesVio.exe declared no
// execution level, no supported Windows version and no long-path awareness.
describe('Windows application manifest', () => {
	it('is the manifest the build script embeds', () => {
		expect(buildScript).toContain(
			'.app_manifest(include_str!("windows-app-manifest.xml"))',
		)
	})

	it('keeps the Common Controls v6 dependency native dialogs rely on', () => {
		expect(manifest).toContain('name="Microsoft.Windows.Common-Controls"')
		expect(manifest).toContain('version="6.0.0.0"')
	})

	it('runs as the invoking user and never asks for elevation', () => {
		expect(manifest).toContain(
			'<requestedExecutionLevel level="asInvoker" uiAccess="false" />',
		)
		expect(manifest).not.toMatch(/requireAdministrator|highestAvailable/)
	})

	it('declares Windows 10 and 11 support and long-path awareness', () => {
		expect(manifest).toContain(
			'<supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />',
		)
		expect(manifest).toMatch(/<longPathAware[^>]*>true<\/longPathAware>/)
	})
})
