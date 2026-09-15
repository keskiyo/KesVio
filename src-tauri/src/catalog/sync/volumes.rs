use super::scan::run_coordinated_scan;
use super::watcher::restart_change_watcher;
use crate::app_state::{tracked_volumes, AppState};
use crate::catalog::scan_settings::{self, ScanSettings};
use crate::catalog::sync::SyncRequest;
use crate::catalog::volumes::{folder_letter, volume_key, TrackedVolume};
use crate::paths;
use crate::platform::windows::volume_watcher::{self, VolumeChange};
use crate::platform::windows::volumes::VolumeIdentity;
use std::path::Path;
use std::sync::Arc;
use tauri::Manager;

pub(crate) fn start_volume_watcher(app: tauri::AppHandle) {
    let callback_handle = app.clone();
    let callback = Arc::new(move |change: VolumeChange| {
        let handle = callback_handle.clone();
        tauri::async_runtime::spawn(async move {
            let _ = tauri::async_runtime::spawn_blocking(move || {
                follow_volume_change(&handle, change);
            })
            .await;
        });
    });
    let watcher = volume_watcher::start(callback);
    if watcher.is_some() {
        log::info!("Volume watcher started");
    } else {
        log::warn!("Volume watcher unavailable: removable drives are not tracked");
    }
    let state = app.state::<AppState>();
    if let Ok(mut current) = state.volume_watcher.lock() {
        *current = watcher;
    };
}

fn follow_volume_change(app: &tauri::AppHandle, change: VolumeChange) {
    let Ok(app_data_dir) = paths::data_dir(app) else {
        return;
    };
    let settings = scan_settings::read(&app_data_dir);
    let tracked = tracked_volumes(app.state::<AppState>().inner());
    let relevant = concerns_catalog(&settings, &tracked, &change, |letter| {
        crate::platform::windows::volumes::volume_identity(Path::new(&format!(r"{letter}:\")))
    });
    if !relevant {
        return;
    }
    log::info!("Volume change {change:?} touches a scan folder: refreshing the catalog");
    if matches!(change, VolumeChange::Arrived(_)) {
        restart_change_watcher(app.clone(), &settings);
    }
    let _ = run_coordinated_scan(app, SyncRequest::Refresh, false);
}

fn concerns_catalog(
    settings: &ScanSettings,
    tracked: &[TrackedVolume],
    change: &VolumeChange,
    identity_of: impl Fn(char) -> Option<VolumeIdentity>,
) -> bool {
    if touches_scan_folder(settings, change.letters()) {
        return true;
    }
    match change {
        VolumeChange::Arrived(letters) => letters.iter().any(|letter| {
            identity_of(*letter).is_some_and(|identity| {
                let key = volume_key(&identity);
                tracked
                    .iter()
                    .any(|entry| entry.serial.eq_ignore_ascii_case(&key))
            })
        }),
        VolumeChange::Removed(letters) => letters.iter().any(|letter| {
            tracked.iter().any(|entry| {
                entry
                    .mounted_at
                    .as_deref()
                    .and_then(folder_letter)
                    .is_some_and(|mounted| mounted.eq_ignore_ascii_case(letter))
            })
        }),
    }
}

fn touches_scan_folder(settings: &ScanSettings, letters: &[char]) -> bool {
    settings.included_paths.iter().any(|folder| {
        folder_letter(folder).is_some_and(|letter| {
            letters
                .iter()
                .any(|changed| changed.eq_ignore_ascii_case(&letter))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(included_paths: &[&str]) -> ScanSettings {
        ScanSettings {
            included_paths: included_paths
                .iter()
                .map(|path| (*path).to_owned())
                .collect(),
            ..ScanSettings::default()
        }
    }

    fn tracked(folder: &str, serial: &str, mounted_at: Option<&str>) -> TrackedVolume {
        TrackedVolume {
            folder: folder.into(),
            serial: serial.into(),
            label: "STICK".into(),
            filesystem: "FAT32".into(),
            mounted_at: mounted_at.map(str::to_owned),
        }
    }

    fn identity(serial: u32) -> VolumeIdentity {
        VolumeIdentity {
            serial,
            label: "STICK".into(),
            filesystem: "FAT32".into(),
        }
    }

    #[test]
    fn a_letter_matching_a_scan_folder_triggers_regardless_of_case_or_depth() {
        assert!(touches_scan_folder(&settings(&[r"F:\"]), &['F']));
        assert!(touches_scan_folder(&settings(&[r"f:\"]), &['F']));
        assert!(touches_scan_folder(&settings(&[r"F:\Apps"]), &['E', 'F']));
        assert!(touches_scan_folder(&settings(&[r" F:\ "]), &['F']));
    }

    #[test]
    fn other_letters_and_unrooted_folders_are_ignored() {
        assert!(!touches_scan_folder(&settings(&[r"F:\"]), &['E']));
        assert!(!touches_scan_folder(&settings(&[r"D:\Apps"]), &['F']));
        assert!(!touches_scan_folder(
            &settings(&[r"\\server\share"]),
            &['F']
        ));
        assert!(!touches_scan_folder(&settings(&[]), &['F']));
        assert!(!touches_scan_folder(&settings(&[r"F:\"]), &[]));
    }

    #[test]
    fn an_arriving_letter_that_holds_a_tracked_volume_refreshes_even_at_a_new_letter() {
        let entries = [tracked(r"F:\", "1a2b3c4d", None)];
        let reads = std::cell::Cell::new(0);
        let identity_of = |letter: char| {
            reads.set(reads.get() + 1);
            (letter == 'G').then(|| identity(0x1a2b3c4d))
        };

        assert!(concerns_catalog(
            &settings(&[r"F:\"]),
            &entries,
            &VolumeChange::Arrived(vec!['G']),
            identity_of,
        ));
        assert!(!concerns_catalog(
            &settings(&[r"F:\"]),
            &entries,
            &VolumeChange::Arrived(vec!['H']),
            identity_of,
        ));
        assert!(!concerns_catalog(
            &settings(&[r"F:\"]),
            &[],
            &VolumeChange::Arrived(vec!['G']),
            identity_of,
        ));
        assert!(reads.get() >= 2);
    }

    #[test]
    fn a_configured_letter_refreshes_without_reading_any_identity() {
        let identity_of = |_: char| -> Option<VolumeIdentity> { panic!("no identity is read") };

        assert!(concerns_catalog(
            &settings(&[r"F:\"]),
            &[],
            &VolumeChange::Arrived(vec!['F']),
            identity_of,
        ));
    }

    #[test]
    fn a_removed_letter_where_a_tracked_volume_was_mounted_refreshes() {
        let entries = [tracked(r"F:\", "1a2b3c4d", Some(r"G:\"))];
        let identity_of = |_: char| -> Option<VolumeIdentity> { None };

        assert!(concerns_catalog(
            &settings(&[r"F:\"]),
            &entries,
            &VolumeChange::Removed(vec!['g']),
            identity_of,
        ));
        assert!(!concerns_catalog(
            &settings(&[r"F:\"]),
            &entries,
            &VolumeChange::Removed(vec!['H']),
            identity_of,
        ));
        assert!(!concerns_catalog(
            &settings(&[r"F:\"]),
            &[tracked(r"F:\", "1a2b3c4d", None)],
            &VolumeChange::Removed(vec!['G']),
            identity_of,
        ));
    }
}
