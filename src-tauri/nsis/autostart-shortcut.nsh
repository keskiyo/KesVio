; Startup registration belongs to the installer and to Windows, never to the running program.
;
; Windows Apps up to 0.3.8 wrote an HKCU Run value from the .exe itself while it ran. Kaspersky's
; proactive defence module scores exactly that, and returned PDM:Trojan.Win32.Generic for an
; unsigned binary with no reputation. A Startup shortcut created once by the installer is ordinary
; installer behaviour, and the user manages it in Settings -> Apps -> Startup like any other entry.
;
; Both hooks are guarded with `$UpdateMode <> 1`, and the guards depend on each other. An update
; runs the *old* uninstaller with /UPDATE before the new installer, so an unguarded uninstall hook
; would delete the shortcut that the guarded install hook then refuses to recreate — autostart
; would switch itself off on every update. Guarding both leaves an update from touching it at all,
; which also preserves a user who turned the entry off in Windows Settings: that switch writes to
; StartupApproved and leaves the shortcut in place.
;
; The legacy Run value is deleted on every install, including updates. Tauri's own uninstall
; section already deletes it, but skips that when updating, so the upgrade path needs this.

!macro NSIS_HOOK_POSTINSTALL
  SetShellVarContext current
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
  ${If} $UpdateMode <> 1
    CreateShortcut "$SMSTARTUP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "--autostart"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    SetShellVarContext current
    Delete "$SMSTARTUP\${PRODUCTNAME}.lnk"
  ${EndIf}
!macroend
