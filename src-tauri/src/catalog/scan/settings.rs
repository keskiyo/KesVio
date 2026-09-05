use serde::{Deserialize, Serialize};
use std::path::Path;
use std::{fs, io};

const SETTINGS_FILE: &str = "scan-settings.json";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScanSettings {
    pub auto_scan_fixed_drives: bool,
    #[serde(default)]
    pub included_paths: Vec<String>,
    #[serde(default)]
    pub excluded_paths: Vec<String>,
    #[serde(default = "enabled")]
    pub catalog_target_availability_v1: bool,
    #[serde(default = "enabled")]
    pub catalog_portable_fingerprint_v1: bool,
}

fn enabled() -> bool {
    true
}

impl Default for ScanSettings {
    fn default() -> Self {
        Self {
            auto_scan_fixed_drives: true,
            included_paths: Vec::new(),
            excluded_paths: Vec::new(),
            catalog_target_availability_v1: true,
            catalog_portable_fingerprint_v1: true,
        }
    }
}

pub(crate) fn read(app_data_dir: &Path) -> ScanSettings {
    fs::read(app_data_dir.join(SETTINGS_FILE))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub(crate) fn write(app_data_dir: &Path, settings: &ScanSettings) -> io::Result<()> {
    if stored_matches(app_data_dir, settings) {
        return Ok(());
    }
    fs::create_dir_all(app_data_dir)?;
    let bytes = serde_json::to_vec_pretty(settings).map_err(io::Error::other)?;
    let temporary = app_data_dir.join("scan-settings.json.tmp");
    fs::write(&temporary, bytes)?;
    fs::rename(temporary, app_data_dir.join(SETTINGS_FILE))
}

fn stored_matches(app_data_dir: &Path, settings: &ScanSettings) -> bool {
    fs::read(app_data_dir.join(SETTINGS_FILE))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<ScanSettings>(&bytes).ok())
        .is_some_and(|stored| &stored == settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_scan_settings() {
        let dir = tempfile::tempdir().unwrap();
        let settings = ScanSettings {
            auto_scan_fixed_drives: true,
            included_paths: vec![r"E:\Portable".into()],
            excluded_paths: vec![r"D:\Archives".into()],
            catalog_target_availability_v1: true,
            catalog_portable_fingerprint_v1: true,
        };

        write(dir.path(), &settings).unwrap();

        assert_eq!(read(dir.path()), settings);
    }

    #[test]
    fn writing_the_stored_value_again_leaves_the_file_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let settings = ScanSettings::default();
        write(dir.path(), &settings).unwrap();
        let path = dir.path().join(SETTINGS_FILE);
        let written_at = std::fs::metadata(&path).unwrap().modified().unwrap();

        write(dir.path(), &settings).unwrap();

        assert_eq!(
            std::fs::metadata(&path).unwrap().modified().unwrap(),
            written_at
        );
        assert_eq!(read(dir.path()), settings);
    }

    #[test]
    fn a_changed_value_still_replaces_the_stored_one() {
        let dir = tempfile::tempdir().unwrap();
        write(dir.path(), &ScanSettings::default()).unwrap();
        let changed = ScanSettings {
            auto_scan_fixed_drives: false,
            ..ScanSettings::default()
        };

        write(dir.path(), &changed).unwrap();

        assert_eq!(read(dir.path()), changed);
    }

    #[test]
    fn a_malformed_file_is_replaced_rather_than_mistaken_for_a_match() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(SETTINGS_FILE), "not json").unwrap();

        write(dir.path(), &ScanSettings::default()).unwrap();

        assert_eq!(
            serde_json::from_slice::<ScanSettings>(
                &std::fs::read(dir.path().join(SETTINGS_FILE)).unwrap()
            )
            .unwrap(),
            ScanSettings::default()
        );
    }

    #[test]
    fn missing_or_invalid_settings_use_safe_defaults() {
        let dir = tempfile::tempdir().unwrap();
        assert!(ScanSettings::default().auto_scan_fixed_drives);
        assert_eq!(read(dir.path()), ScanSettings::default());
        std::fs::write(dir.path().join(SETTINGS_FILE), "not json").unwrap();
        assert_eq!(read(dir.path()), ScanSettings::default());
    }
}
