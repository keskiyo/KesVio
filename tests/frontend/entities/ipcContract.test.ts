import { describe, expect, it } from 'vitest'
import recorded from '../../../src-tauri/tests/fixtures/ipc/contract.json'
import type {
	AppDetails,
	AppHydrationPatch,
	AppInfo,
	CatalogChangeSummary,
	CatalogDelta,
	CatalogScanResult,
	CatalogSnapshot,
	CloseAppsResult,
	CloseProgress,
	LaunchStatus,
	ScanProgress,
} from '../../../src/entities/app'
import type {
	ScanSettings,
	StaleCopyInfo,
	SystemSettings,
} from '../../../src/entities/system'

const contract = recorded as unknown as {
	commands: Record<string, unknown>
	events: Record<string, unknown>
	error: unknown
	errorCodes: string[]
}

// Marks the interface owns outright: the catalog never sends them, the store writes them from
// preferences. They belong to the type but must not appear on the wire.
const FRONTEND_ONLY: Record<string, string[]> = {
	AppInfo: ['userPromoted', 'userPlacedArtifact'],
}

// Rollback switches the backend reads from disk and refuses to take from the window
// (`the_availability_rollback_flag_comes_from_disk_not_from_the_window` in commands/settings.rs).
// They ride along on the wire, and the interface deliberately does not offer them.
const BACKEND_ONLY: Record<string, string[]> = {
	ScanSettings: [
		'catalogTargetAvailabilityV1',
		'catalogPortableFingerprintV1',
	],
}

function expectWireShape(
	payload: unknown,
	declared: Record<string, unknown>,
	name: string,
) {
	const frontendOnly = FRONTEND_ONLY[name] ?? []
	const expected = [
		...Object.keys(declared).filter(key => !frontendOnly.includes(key)),
		...(BACKEND_ONLY[name] ?? []),
	].sort()

	expect(Object.keys(payload as object).sort(), name).toEqual(expected)
}

const appInfo: Required<AppInfo> = {
	id: '',
	name: '',
	path: '',
	iconBase64: null,
	artifactKind: 'application',
	category: '',
	launchKind: 'executable',
	sourceKind: 'registry',
	platformKind: null,
	description: null,
	version: null,
	publisher: null,
	productName: null,
	originalFilename: null,
	installLocation: null,
	canUninstall: false,
	canonicalIdentity: null,
	preferenceIdentity: null,
	userPromoted: false,
	userPlacedArtifact: false,
	visibilityClass: 'primary',
	visibilityScore: 0,
	visibilityReasons: [],
	targetAvailability: null,
	categoryReasons: [],
	closeRisk: null,
}

const scanSettings: Required<ScanSettings> = {
	autoScanFixedDrives: false,
	includedPaths: [],
	excludedPaths: [],
}

// The frontend and the backend describe the same payloads in two languages, and nothing compiled
// them together: a scan command changed its response shape while the typed fake kept returning the
// old one, and every icon in the catalog went blank in a shipped build. This fixture is recorded
// from the Rust structs themselves, so the two descriptions can no longer drift apart in silence.
describe('IPC wire contract', () => {
	describe('command responses', () => {
		it('describes a catalog record the way the interface does', () => {
			const snapshot = contract.commands.get_apps as CatalogSnapshot
			expectWireShape(snapshot.apps[0], appInfo, 'AppInfo')
		})

		it('describes the startup snapshot', () => {
			const declared: Required<CatalogSnapshot> = {
				apps: [],
				hasCache: false,
				generation: 0,
				diagnostics: null,
			}
			expectWireShape(
				contract.commands.get_apps,
				declared,
				'CatalogSnapshot',
			)
		})

		it('describes every scan result as records plus the generation that made them', () => {
			const declared: Required<CatalogScanResult> = {
				apps: [],
				generation: 0,
			}
			for (const command of [
				'refresh_apps',
				'force_full_scan',
				'reset_catalog_cache',
			])
				expectWireShape(
					contract.commands[command],
					declared,
					`CatalogScanResult.${command}`,
				)
		})

		it('describes application details', () => {
			const declared: Required<AppDetails> = {
				fileSizeBytes: null,
				fileCreatedAt: null,
				fileModifiedAt: null,
				architecture: 'unknown',
				signature: 'unavailable',
				executableExists: null,
				installLocationExists: null,
				canOpenFolder: false,
			}
			expectWireShape(
				contract.commands.get_app_details,
				declared,
				'AppDetails',
			)
		})

		it('describes the close result', () => {
			const declared: Required<CloseAppsResult> = {
				closed: 0,
				notRunning: 0,
				unavailable: 0,
				blocked: 0,
				failed: 0,
			}
			expectWireShape(
				contract.commands.close_apps,
				declared,
				'CloseAppsResult',
			)
		})

		it('describes system settings and the scan settings inside them', () => {
			const declared: Required<SystemSettings> = {
				version: '',
				shortcut: { available: false, label: '', error: null },
				scanSettings,
				fixedDrives: [],
				hideToTrayOnClose: false,
			}
			const settings = contract.commands
				.get_system_settings as SystemSettings
			expectWireShape(settings, declared, 'SystemSettings')
			expectWireShape(settings.scanSettings, scanSettings, 'ScanSettings')
			expectWireShape(
				contract.commands.set_scan_settings,
				scanSettings,
				'ScanSettings',
			)
		})

		it('describes the stale installed copy', () => {
			const declared: Required<StaleCopyInfo> = {
				installedVersion: '',
				installLocation: '',
			}
			expectWireShape(
				contract.commands.stale_copy_status,
				declared,
				'StaleCopyInfo',
			)
		})

		it('answers the preferences backup with a single flag', () => {
			expect(typeof contract.commands.save_preferences_backup).toBe(
				'boolean',
			)
		})

		// The tray owns the menu; the window only tells it what to show, so neither call answers
		// with data the frontend could come to depend on.
		it('answers both tray updates with nothing', () => {
			expect(contract.commands).toHaveProperty('set_tray_scenarios')
			expect(contract.commands).toHaveProperty('set_tray_running')
			expect(contract.commands.set_tray_scenarios).toBeNull()
			expect(contract.commands.set_tray_running).toBeNull()
			expect(contract.commands.set_tray_scan_state).toBeNull()
		})
	})

	describe('events', () => {
		it('requests a tray full scan without accepting a path or command', () => {
			expect(contract.events['tray://force-full-scan']).toBeNull()
		})
		it('describes the catalog delta', () => {
			const declared: Required<CatalogDelta> = {
				generation: 0,
				upserted: [],
				removedIds: [],
				summary: { added: 0, removed: 0, updated: 0 },
			}
			const delta = contract.events['catalog://delta'] as CatalogDelta
			expectWireShape(delta, declared, 'CatalogDelta')
			expectWireShape(delta.upserted[0], appInfo, 'AppInfo')
		})

		it('describes the change summary', () => {
			const declared: Required<CatalogChangeSummary> = {
				added: 0,
				removed: 0,
				updated: 0,
			}
			expectWireShape(
				contract.events['catalog://changed'],
				declared,
				'CatalogChangeSummary',
			)
		})

		it('describes a hydration patch', () => {
			const declared: Required<AppHydrationPatch> = {
				id: '',
				generation: 0,
				platformKind: 'battle_net',
				iconBase64: '',
				description: '',
				version: '',
				publisher: '',
				productName: '',
				originalFilename: '',
				installLocation: '',
				canUninstall: false,
			}
			const patches = contract.events[
				'catalog://patches'
			] as AppHydrationPatch[]
			expectWireShape(patches[0], declared, 'AppHydrationPatch')
		})

		it('describes scan progress', () => {
			const declared: Required<ScanProgress> = {
				stage: '',
				location: null,
				completedRoots: 0,
				totalRoots: 0,
			}
			expectWireShape(
				contract.events['scan://progress'],
				declared,
				'ScanProgress',
			)
		})

		it('describes launch status', () => {
			const declared: Required<LaunchStatus> = { id: '', state: 'ready' }
			expectWireShape(
				contract.events['launch://status'],
				declared,
				'LaunchStatus',
			)
		})

		it('describes close progress', () => {
			const declared: Required<CloseProgress> = {
				stage: 'waiting',
				running: 0,
				secondsLeft: 0,
			}
			expectWireShape(
				contract.events['close://progress'],
				declared,
				'CloseProgress',
			)
		})

		// The tray echoes back an id the window gave it and nothing else: the scenario itself
		// never crosses to Rust, so the payload cannot grow scenario data by accident.
		it('describes a tray scenario run as the id alone', () => {
			expectWireShape(
				contract.events['tray://run-scenario'],
				{ id: '' },
				'TrayScenarioRun',
			)
		})
	})

	it('answers a failure with the code and the safe message only', () => {
		expect(Object.keys(contract.error as object).sort()).toEqual([
			'code',
			'message',
		])
	})

	// The recorded code list is held against `APP_ERROR_CODES` by
	// `mirrors the backend AppError code contract exactly` in entities/app/appsClient.test.ts,
	// which owns that seam. Recording it here keeps Rust the single source of that list.
	it('records every error code the backend can send', () => {
		expect(contract.errorCodes.length).toBeGreaterThan(0)
		expect(contract.errorCodes).toEqual([...contract.errorCodes].sort())
		expect(new Set(contract.errorCodes).size).toBe(
			contract.errorCodes.length,
		)
	})
})
