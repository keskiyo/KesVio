use crate::platform::windows::com::ensure_initialized;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use windows::core::{PCWSTR, PSTR};
use windows::Win32::UI::Shell::{
    BHID_SFUIObject, IContextMenu, IShellItem, SHCreateItemFromParsingName, CMF_NORMAL, GCS_VERBW,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreatePopupMenu, DestroyMenu, GetMenuItemCount, GetMenuItemID, HMENU,
};

const FIRST_COMMAND: u32 = 1;
const LAST_COMMAND: u32 = 0x7FFF;
const VERB_CAPACITY: usize = 64;

struct PopupMenu(HMENU);

impl Drop for PopupMenu {
    fn drop(&mut self) {
        // SAFETY: the menu was created by `CreatePopupMenu` in `shell_item_verbs`, is owned only by
        // this guard, and is attached to no window, so destroying it here is the single release.
        let _ = unsafe { DestroyMenu(self.0) };
    }
}

pub(super) fn shell_item_has_runas(parsing_name: &str) -> bool {
    ensure_initialized();
    shell_item_verbs(parsing_name)
        .map(|verbs| verbs.iter().any(|verb| is_runas(verb)))
        .unwrap_or(false)
}

fn is_runas(verb: &str) -> bool {
    verb.trim().eq_ignore_ascii_case("runas")
}

fn verb_from(buffer: &[u16]) -> String {
    let verb = buffer.split(|unit| *unit == 0).next().unwrap_or(&[]);
    String::from_utf16_lossy(verb)
}

fn shell_item_verbs(parsing_name: &str) -> windows::core::Result<Vec<String>> {
    let wide: Vec<u16> = OsStr::new(parsing_name)
        .encode_wide()
        .chain(Some(0))
        .collect();
    // SAFETY: `shell_item_has_runas` joined a COM apartment on this thread before calling, which
    // every shell interface below requires. `wide` is NUL-terminated and alive for the call. The
    // item and its context menu are reference-counted interfaces released when they drop, and `?`
    // returns before either binding exists on failure.
    let menu_handler: IContextMenu = unsafe {
        let item: IShellItem = SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None)?;
        item.BindToHandler(None, &BHID_SFUIObject)?
    };
    // SAFETY: `CreatePopupMenu` takes no caller memory; the handle it returns is owned by the
    // `PopupMenu` guard, which destroys it on every path out of this function.
    let menu = PopupMenu(unsafe { CreatePopupMenu()? });
    // SAFETY: `menu.0` is a live popup menu owned by the guard above, and the command range
    // `FIRST_COMMAND..=LAST_COMMAND` is what the loop below reads back. The handler only inserts
    // items into that menu; it keeps no reference to it after returning.
    unsafe {
        menu_handler
            .QueryContextMenu(menu.0, 0, FIRST_COMMAND, LAST_COMMAND, CMF_NORMAL)
            .ok()?;
    }
    // SAFETY: `menu.0` is live for the whole loop. `GetMenuItemID` returns `u32::MAX` for a
    // submenu, which is skipped. `GetCommandString` writes at most `VERB_CAPACITY` UTF-16 units,
    // including the terminator, into `buffer`, a live local of exactly that length; with
    // `GCS_VERBW` the `PSTR` argument is documented to address a wide buffer, so the cast only
    // changes the declared pointer type.
    unsafe {
        let count = GetMenuItemCount(Some(menu.0)).max(0);
        let mut verbs = Vec::new();
        for position in 0..count {
            let id = GetMenuItemID(menu.0, position);
            if !(FIRST_COMMAND..=LAST_COMMAND).contains(&id) {
                continue;
            }
            let mut buffer = [0_u16; VERB_CAPACITY];
            let named = menu_handler.GetCommandString(
                (id - FIRST_COMMAND) as usize,
                GCS_VERBW,
                None,
                PSTR(buffer.as_mut_ptr().cast()),
                VERB_CAPACITY as u32,
            );
            if named.is_ok() {
                verbs.push(verb_from(&buffer));
            }
        }
        Ok(verbs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_the_canonical_elevation_verb_only() {
        assert!(is_runas("runas"));
        assert!(is_runas("RunAs"));
        assert!(!is_runas("runasuser"));
        assert!(!is_runas("open"));
    }

    #[test]
    fn reads_a_verb_up_to_its_terminator() {
        let mut buffer = [0_u16; 8];
        for (slot, unit) in buffer.iter_mut().zip("runas".encode_utf16()) {
            *slot = unit;
        }
        assert_eq!(verb_from(&buffer), "runas");
        assert_eq!(verb_from(&[]), "");
    }

    #[test]
    #[ignore = "asks the live shell of this machine; run with --ignored to verify by hand"]
    fn command_prompt_offers_elevation_and_explorer_does_not() {
        assert!(shell_item_has_runas(
            r"shell:AppsFolder\{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\cmd.exe"
        ));
        assert!(!shell_item_has_runas(
            r"shell:AppsFolder\Microsoft.Windows.Explorer"
        ));
    }
}
