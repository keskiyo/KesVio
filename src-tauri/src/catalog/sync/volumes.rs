use super::scan::run_coordinated_scan;
use super::watcher::restart_change_watcher;
use crate::app_state::AppState;
use crate::catalog::scan_settings::{self, ScanSettings};
use crate::catalog::sync::SyncRequest;
use crate::paths;
use crate::platform::windows::volume_watcher::{self, VolumeChange};
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
    if !touches_scan_folder(&settings, change.letters()) {
        return;
    }
    log::info!("Volume change {change:?} touches a scan folder: refreshing the catalog");
    if matches!(change, VolumeChange::Arrived(_)) {
        restart_change_watcher(app.clone(), &settings);
    }
    let _ = run_coordinated_scan(app, SyncRequest::Refresh, false);
}

fn touches_scan_folder(settings: &ScanSettings, letters: &[char]) -> bool {
    settings.included_paths.iter().any(|folder| {
        scan_folder_letter(folder).is_some_and(|letter| {
            letters
                .iter()
                .any(|changed| changed.eq_ignore_ascii_case(&letter))
        })
    })
}

fn scan_folder_letter(folder: &str) -> Option<char> {
    let mut characters = folder.trim().chars();
    let letter = characters.next()?;
    (letter.is_ascii_alphabetic() && characters.next() == Some(':')).then_some(letter)
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
}
