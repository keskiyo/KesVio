import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const installerHooks = readFileSync(
	'src-tauri/nsis/autostart-shortcut.nsh',
	'utf8',
)

/**
 * Windows only lists an application under Settings → Apps → Startup once an entry for it exists.
 * The shortcut alone would list it switched *on*, which is not the installer's call to make; the
 * approval value alone would list nothing. Creating both — the shortcut plus a StartupApproved
 * payload whose first byte is 0x03 — is what puts KesVio on that page already switched off, ready
 * for the user to decide.
 */
describe('NSIS startup registration', () => {
	const install = installerHooks.slice(
		installerHooks.indexOf('!macro NSIS_HOOK_POSTINSTALL'),
		installerHooks.indexOf('!macro NSIS_HOOK_POSTUNINSTALL'),
	)

	it('creates the startup shortcut so Windows lists the application at all', () => {
		expect(install).toContain(
			'CreateShortcut "$SMSTARTUP\\${PRODUCTNAME}.lnk"',
		)
		expect(install).toContain('--autostart')
	})

	it('registers that shortcut as disabled rather than switching autostart on', () => {
		expect(installerHooks).toContain(
			'Explorer\\StartupApproved\\StartupFolder',
		)
		expect(install).toMatch(
			/WriteRegBin HKCU "\$\{KESVIO_STARTUP_APPROVED\}" "\$\{PRODUCTNAME\}\.lnk" "030{22}"/,
		)
		expect(install).not.toContain('"02')
	})

	it('leaves the shortcut and the user choice alone while updating', () => {
		const guard = install.indexOf('$UpdateMode <> 1')
		expect(guard).toBeGreaterThan(-1)
		expect(install.indexOf('CreateShortcut')).toBeGreaterThan(guard)
		expect(install.indexOf('WriteRegBin')).toBeGreaterThan(guard)
	})

	// A setup.exe run by hand over an existing copy is not an update, and by then the Settings
	// switch may have turned the entry on. Writing the disabled payload unconditionally reset that
	// choice on every manual reinstall.
	it('writes the disabled payload only when no approval value exists yet', () => {
		const probe = install.indexOf('Call KesVioReadStartupApproval')
		const gate = install.indexOf('$KesVioStartupApprovalExists = 0')
		const write = install.indexOf('WriteRegBin')
		expect(probe).toBeGreaterThan(-1)
		expect(gate).toBeGreaterThan(probe)
		expect(write).toBeGreaterThan(gate)
		expect(install).toContain('Push "${PRODUCTNAME}.lnk"')
	})

	it('finds the approval value by enumerating names, never by reading it as a string', () => {
		const reader = installerHooks.slice(
			installerHooks.indexOf('Function KesVioReadStartupApproval'),
			installerHooks.indexOf('FunctionEnd'),
		)
		expect(reader).toContain(
			'EnumRegValue $1 HKCU "${KESVIO_STARTUP_APPROVED}" $0',
		)
		expect(reader).not.toContain('ReadRegStr')
		expect(reader).not.toContain('${PRODUCTNAME}')
	})

	it('deletes the legacy Run value on every install, update included', () => {
		const guard = install.indexOf('$UpdateMode <> 1')
		expect(install.indexOf('CurrentVersion\\Run')).toBeLessThan(guard)
	})

	// The running program records its install directory under HKCU\Software\<publisher>\<product>.
	// Tauri's uninstall section has never heard of that key, so an uninstall left it behind — the
	// kind of remnant the Microsoft Store "uninstall cleanly" certification test looks for.
	it('removes the install-location key the running program writes', () => {
		const hookBody = installerHooks.slice(
			installerHooks.indexOf('!macro NSIS_HOOK_POSTUNINSTALL'),
		)

		expect(hookBody).toContain(
			'DeleteRegKey HKCU "Software\\${MANUFACTURER}\\${PRODUCTNAME}"',
		)
		expect(hookBody).toContain(
			'DeleteRegKey /ifempty HKCU "Software\\${MANUFACTURER}"',
		)
	})

	it('keeps the publisher key unless it is empty, so a sibling product survives', () => {
		const hookBody = installerHooks.slice(
			installerHooks.indexOf('!macro NSIS_HOOK_POSTUNINSTALL'),
		)
		const publisherKey = hookBody.match(
			/DeleteRegKey (\/ifempty )?HKCU "Software\\\$\{MANUFACTURER\}"/,
		)

		expect(publisherKey?.[1]).toBe('/ifempty ')
	})

	it('removes the shortcut and its approval on a normal uninstall only', () => {
		expect(installerHooks).toContain('NSIS_HOOK_POSTUNINSTALL')
		expect(installerHooks).toContain('$UpdateMode <> 1')
		expect(installerHooks).toContain(
			'Delete "$SMSTARTUP\\${PRODUCTNAME}.lnk"',
		)
		expect(installerHooks).toContain(
			'DeleteRegValue HKCU "${KESVIO_STARTUP_APPROVED}" "${PRODUCTNAME}.lnk"',
		)
	})

	// The reinstall page's default choice runs the old uninstaller with `_?=<dir>`; a user-started
	// uninstall never carries that parameter. Deleting the entry in the first case reset the
	// startup choice on every manual upgrade.
	it('keeps the entry when the installer itself runs the uninstaller', () => {
		const hookBody = installerHooks.slice(
			installerHooks.indexOf('!macro NSIS_HOOK_POSTUNINSTALL'),
		)
		const probe = hookBody.indexOf('${GetOptions} $CMDLINE "_?="')
		const guard = hookBody.indexOf('${If} ${Errors}')
		expect(probe).toBeGreaterThan(-1)
		expect(guard).toBeGreaterThan(probe)
		expect(hookBody.indexOf('Delete "$SMSTARTUP')).toBeGreaterThan(guard)
		expect(
			hookBody.indexOf(
				'DeleteRegValue HKCU "${KESVIO_STARTUP_APPROVED}"',
			),
		).toBeGreaterThan(guard)
		expect(
			hookBody.indexOf('DeleteRegKey HKCU "Software\\${MANUFACTURER}'),
		).toBeGreaterThan(hookBody.indexOf('${EndIf}'))
	})
})

/**
 * Tauri's uninstall section deletes the files it installed, clears $APPDATA\<bundle> and
 * $LOCALAPPDATA\<bundle> when the user ticks "Delete app data", and finishes with a
 * non-recursive `RMDir "$INSTDIR"`. None of that reaches $INSTDIR\KesVioData, which is where
 * the catalog cache, scan settings, window state and uninstall history now live, so the hook
 * below is the only thing that keeps uninstall honest.
 */
describe('NSIS data-root cleanup', () => {
	const hookBody = installerHooks.slice(
		installerHooks.indexOf('!macro NSIS_HOOK_POSTUNINSTALL'),
	)

	it('deletes the data root only when the user asked for it', () => {
		expect(hookBody).toContain('$DeleteAppDataCheckboxState = 1')
		expect(hookBody).toContain('RMDir /r "$INSTDIR\\KesVioData"')
	})

	it('always removes the diagnostics logs, which are not user data', () => {
		expect(hookBody).toContain('RMDir /r "$INSTDIR\\KesVioData\\logs"')
	})

	it('leaves no empty install directory behind', () => {
		expect(hookBody).toContain('RMDir "$INSTDIR"')
	})

	it('never touches the data root while updating', () => {
		const guard = hookBody.indexOf('$UpdateMode <> 1')
		expect(guard).toBeGreaterThan(-1)
		expect(hookBody.indexOf('KesVioData')).toBeGreaterThan(guard)
	})

	it('refuses to recurse from an empty install directory', () => {
		expect(hookBody).toContain('$INSTDIR != ""')
		expect(hookBody.indexOf('$INSTDIR != ""')).toBeLessThan(
			hookBody.indexOf('RMDir /r'),
		)
	})
})
