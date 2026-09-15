use crate::platform::windows::known_folders;
use serde::Serialize;
use std::path::PathBuf;
use winreg::enums::{RegType, HKEY_CURRENT_USER};
use winreg::{RegKey, RegValue};

const APPROVAL_KEY: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder";
const ENABLED_MARK: u8 = 0x02;
const DISABLED_MARK: u8 = 0x03;
const PAYLOAD_LEN: usize = 12;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum StartupEntry {
    Enabled,
    Disabled,
    Missing,
}

fn value_name(product: &str) -> String {
    format!("{product}.lnk")
}

fn shortcut_path(product: &str) -> Option<PathBuf> {
    known_folders::startup().map(|folder| folder.join(value_name(product)))
}

fn entry_from_payload(payload: &[u8]) -> StartupEntry {
    match payload.first() {
        Some(mark) if mark & 1 == 1 => StartupEntry::Disabled,
        _ => StartupEntry::Enabled,
    }
}

fn payload_for(enabled: bool) -> [u8; PAYLOAD_LEN] {
    let mut payload = [0; PAYLOAD_LEN];
    payload[0] = if enabled { ENABLED_MARK } else { DISABLED_MARK };
    payload
}

fn approval_state(product: &str) -> StartupEntry {
    let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey(APPROVAL_KEY) else {
        return StartupEntry::Enabled;
    };
    match key.get_raw_value(value_name(product)) {
        Ok(value) => entry_from_payload(&value.bytes),
        Err(_) => StartupEntry::Enabled,
    }
}

pub(crate) fn read(product: &str) -> StartupEntry {
    if !shortcut_path(product).is_some_and(|path| path.is_file()) {
        return StartupEntry::Missing;
    }
    approval_state(product)
}

pub(crate) fn write(product: &str, enabled: bool) -> Result<StartupEntry, String> {
    if read(product) == StartupEntry::Missing {
        return Err("the startup shortcut is missing".into());
    }
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(APPROVAL_KEY)
        .map_err(|error| format!("could not open the startup approval key: {error}"))?;
    let value = RegValue {
        vtype: RegType::REG_BINARY,
        bytes: payload_for(enabled).to_vec(),
    };
    key.set_raw_value(value_name(product), &value)
        .map_err(|error| format!("could not write the startup approval value: {error}"))?;
    log::info!("Startup entry updated: enabled={enabled}");
    Ok(read(product))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_absent_or_even_mark_means_enabled() {
        assert_eq!(entry_from_payload(&[]), StartupEntry::Enabled);
        assert_eq!(entry_from_payload(&[0x02]), StartupEntry::Enabled);
        assert_eq!(entry_from_payload(&[0x06, 0, 0, 0]), StartupEntry::Enabled);
    }

    #[test]
    fn an_odd_mark_means_disabled() {
        assert_eq!(
            entry_from_payload(&[0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
            StartupEntry::Disabled
        );
        assert_eq!(entry_from_payload(&[0x07]), StartupEntry::Disabled);
    }

    #[test]
    fn the_written_payload_matches_what_explorer_and_the_installer_write() {
        assert_eq!(payload_for(true), [0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(payload_for(false), [0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(
            entry_from_payload(&payload_for(true)),
            StartupEntry::Enabled
        );
        assert_eq!(
            entry_from_payload(&payload_for(false)),
            StartupEntry::Disabled
        );
    }

    #[test]
    fn the_value_name_is_the_shortcut_file_name() {
        assert_eq!(value_name("KesVio"), "KesVio.lnk");
    }

    #[test]
    fn the_state_serializes_as_a_lowercase_word() {
        assert_eq!(
            serde_json::to_value(StartupEntry::Missing).unwrap(),
            serde_json::json!("missing")
        );
    }
}
