; Startup registration belongs to the installer and to Windows, never to the running program.
;
; AppNook up to 0.3.8 wrote an HKCU Run value from the .exe itself while it ran. Kaspersky's
; proactive defence module scores exactly that, and returned PDM:Trojan.Win32.Generic for an
; unsigned binary with no reputation. The running program has no startup-registration API at all,
; and `scripts/verify-platform-boundaries.ps1` fails the build if one reappears in Rust.
;
; A fresh install creates the Startup shortcut and immediately marks it *disabled* in
; StartupApproved, so AppNook appears in Settings -> Apps -> Startup switched off. The entry has to
; exist before Windows will list it; writing the shortcut alone would silently turn autostart on
; for everybody, and writing only the approval value would list nothing. The 12-byte payload is the
; shape Explorer itself writes: byte 0 is 0x03 for disabled (0x02 is enabled) and the rest is the
; zeroed timestamp. Once the user flips the switch, Explorer rewrites that value, which is why the
; guards below must never run it again.
;
; Both hooks are guarded with `$UpdateMode <> 1`, and the guards depend on each other. An update
; runs the *old* uninstaller with /UPDATE before the new installer, so an unguarded uninstall hook
; would delete the shortcut that the guarded install hook then refuses to recreate — autostart
; would switch itself off on every update. Guarding both leaves an update from touching either the
; shortcut or the user's on/off choice.
;
; The legacy Run value is deleted on every install, including updates. Tauri's own uninstall
; section already deletes it, but skips that when updating, so the upgrade path needs this.
;
; Uninstall also removes the data root, which Tauri cannot know about: since the data folder moved
; beside the executable, everything AppNook writes lives in `$INSTDIR\AppNookData`. Tauri's
; "Delete app data" branch only clears $APPDATA\${BUNDLEID} and $LOCALAPPDATA\${BUNDLEID}, and its
; `RMDir "$INSTDIR"` is not recursive. Logs are diagnostics, not user data, so they go on every
; normal uninstall; the rest goes only when the user ticked the box that promised it.

!define APPNOOK_STARTUP_APPROVED \
  "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder"

!macro NSIS_HOOK_POSTINSTALL
  SetShellVarContext current
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
  ${If} $UpdateMode <> 1
    CreateShortcut "$SMSTARTUP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "--autostart"
    WriteRegBin HKCU "${APPNOOK_STARTUP_APPROVED}" "${PRODUCTNAME}.lnk" "030000000000000000000000"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    SetShellVarContext current
    Delete "$SMSTARTUP\${PRODUCTNAME}.lnk"
    DeleteRegValue HKCU "${APPNOOK_STARTUP_APPROVED}" "${PRODUCTNAME}.lnk"
    ${If} $INSTDIR != ""
      RMDir /r "$INSTDIR\AppNookData\logs"
      ${If} $DeleteAppDataCheckboxState = 1
        RMDir /r "$INSTDIR\AppNookData"
      ${EndIf}
      RMDir "$INSTDIR\AppNookData"
      RMDir "$INSTDIR"
    ${EndIf}
  ${EndIf}
!macroend
