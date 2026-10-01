use super::run_blocking;
use crate::app_state::AppState;
use crate::catalog;
use crate::catalog::sync::{cancel_pending_retry, restart_change_watcher};
use crate::error::AppError;
use crate::lifecycle::{window_state, LifecycleState};
use crate::paths;
use crate::platform::windows::{drives, global_shortcut, startup_approval};
use serde::Serialize;
use std::path::Path;
use std::sync::Arc;
use tauri::Manager;

const MAX_SCAN_PATHS: usize = 256;
const MAX_SCAN_PATH_CHARS: usize = 32_767;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SystemSettings {
    version: &'static str,
    shortcut: global_shortcut::Status,
    scan_settings: catalog::scan_settings::ScanSettings,
    fixed_drives: Vec<String>,
    hide_to_tray_on_close: bool,
    startup_entry: startup_approval::StartupEntry,
}

#[cfg(test)]
pub(super) fn settings_sample() -> SystemSettings {
    SystemSettings {
        version: "0.0.0-sample",
        shortcut: global_shortcut::Status::default(),
        scan_settings: catalog::scan_settings::ScanSettings::default(),
        fixed_drives: vec![r"C:\".into()],
        hide_to_tray_on_close: true,
        startup_entry: startup_approval::StartupEntry::Disabled,
    }
}

fn product_name(app: &tauri::AppHandle) -> Result<String, AppError> {
    app.config()
        .product_name
        .clone()
        .ok_or(AppError::ProductNameMissing)
}

fn normalize_scan_settings(
    settings: catalog::scan_settings::ScanSettings,
    stored: &catalog::scan_settings::ScanSettings,
) -> Result<catalog::scan_settings::ScanSettings, AppError> {
    let normalize = |values: Vec<String>| -> Result<Vec<String>, AppError> {
        if values.len() > MAX_SCAN_PATHS {
            return Err(AppError::ScanSettingsTooLarge);
        }
        let mut normalized = Vec::<String>::new();
        for value in values {
            let value = value.trim().trim_matches('"').to_string();
            if value.is_empty() {
                continue;
            }
            if value.chars().count() > MAX_SCAN_PATH_CHARS {
                return Err(AppError::ScanSettingsTooLarge);
            }
            if !Path::new(&value).is_absolute() {
                return Err(AppError::ScanPathNotAbsolute(value));
            }
            if !normalized
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(&value))
            {
                normalized.push(value);
            }
        }
        Ok(normalized)
    };
    Ok(catalog::scan_settings::ScanSettings {
        auto_scan_fixed_drives: settings.auto_scan_fixed_drives,
        included_paths: normalize(settings.included_paths)?,
        excluded_paths: normalize(settings.excluded_paths)?,
        catalog_target_availability_v1: stored.catalog_target_availability_v1,
        catalog_portable_fingerprint_v1: stored.catalog_portable_fingerprint_v1,
    })
}

#[tauri::command]
pub(crate) async fn get_system_settings(app: tauri::AppHandle) -> Result<SystemSettings, AppError> {
    let app_data_dir =
        paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    let product = product_name(&app)?;
    let (scan_settings, fixed_drives, startup_entry) =
        run_blocking("System settings read", move || {
            let scan_settings = catalog::scan_settings::read(&app_data_dir);
            let fixed_drives = drives::fixed_drive_roots();
            let startup_entry = startup_approval::read(&product);
            (scan_settings, fixed_drives, startup_entry)
        })
        .await?;
    let shortcut = app
        .state::<AppState>()
        .shortcut_status
        .lock()
        .map(|status| status.clone())
        .unwrap_or_default();
    Ok(SystemSettings {
        version: env!("CARGO_PKG_VERSION"),
        shortcut,
        scan_settings,
        fixed_drives: fixed_drives
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect(),
        hide_to_tray_on_close: app.state::<Arc<LifecycleState>>().hides_to_tray(),
        startup_entry,
    })
}

#[tauri::command]
pub(crate) async fn set_startup_enabled(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<startup_approval::StartupEntry, AppError> {
    let product = product_name(&app)?;
    run_blocking("Startup entry update", move || {
        startup_approval::write(&product, enabled)
    })
    .await?
    .map_err(AppError::UpdateStartupEntry)
}

#[tauri::command]
pub(crate) async fn set_close_behavior(
    app: tauri::AppHandle,
    hide_to_tray: bool,
) -> Result<bool, AppError> {
    let app_data_dir =
        paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    let lifecycle = Arc::clone(&app.state::<Arc<LifecycleState>>());
    let previous = lifecycle.hides_to_tray();
    lifecycle.set_hides_to_tray(hide_to_tray);
    let preferences = window_state::preferences_of(&lifecycle);
    let written = run_blocking("Window settings update", move || {
        window_state::write(&app_data_dir, &preferences)
    })
    .await?;
    if let Err(error) = written {
        lifecycle.set_hides_to_tray(previous);
        return Err(AppError::SaveWindowSettings(error.to_string()));
    }
    Ok(hide_to_tray)
}

#[tauri::command]
pub(crate) async fn set_scan_settings(
    app: tauri::AppHandle,
    settings: catalog::scan_settings::ScanSettings,
) -> Result<catalog::scan_settings::ScanSettings, AppError> {
    let app_data_dir =
        paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    let settings = normalize_scan_settings(settings, &catalog::scan_settings::read(&app_data_dir))?;
    let watcher_settings = settings.clone();
    run_blocking("Scan settings update", move || {
        catalog::scan_settings::write(&app_data_dir, &watcher_settings)
            .map_err(|error| AppError::SaveScanSettings(error.to_string()))?;
        restart_change_watcher(app, &watcher_settings);
        Ok::<_, AppError>(())
    })
    .await??;
    Ok(settings)
}

#[tauri::command]
pub(crate) fn cancel_scan(state: tauri::State<'_, AppState>) {
    cancel_pending_retry(state.inner());
    state.scan_coordinator.cancel_all();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_scan_paths_and_accepts_any_absolute_location() {
        let settings = catalog::scan_settings::ScanSettings {
            auto_scan_fixed_drives: true,
            included_paths: vec![
                r"D:\Portable".into(),
                r"d:\portable".into(),
                r"F:\Stick\Tools".into(),
            ],
            excluded_paths: vec![r"\\Server\Share".into()],
            catalog_target_availability_v1: true,
            catalog_portable_fingerprint_v1: true,
        };
        let stored = catalog::scan_settings::ScanSettings::default();
        let normalized = normalize_scan_settings(settings, &stored).unwrap();
        assert_eq!(
            normalized.included_paths,
            vec![r"D:\Portable", r"F:\Stick\Tools"]
        );
        assert_eq!(normalized.excluded_paths, vec![r"\\Server\Share"]);

        let invalid = catalog::scan_settings::ScanSettings {
            auto_scan_fixed_drives: true,
            included_paths: vec![r"relative\path".into()],
            excluded_paths: Vec::new(),
            catalog_target_availability_v1: true,
            catalog_portable_fingerprint_v1: true,
        };
        assert!(normalize_scan_settings(invalid, &stored).is_err());
    }

    #[test]
    fn refuses_an_unbounded_path_list_or_an_impossible_path_before_writing() {
        let stored = catalog::scan_settings::ScanSettings::default();
        let with = |included_paths: Vec<String>| catalog::scan_settings::ScanSettings {
            included_paths,
            ..catalog::scan_settings::ScanSettings::default()
        };

        let at_limit = (0..MAX_SCAN_PATHS)
            .map(|index| format!(r"D:\Folder{index}"))
            .collect::<Vec<_>>();
        assert_eq!(
            normalize_scan_settings(with(at_limit.clone()), &stored)
                .unwrap()
                .included_paths
                .len(),
            MAX_SCAN_PATHS
        );

        let mut too_many = at_limit;
        too_many.push(r"D:\One more".into());
        assert!(matches!(
            normalize_scan_settings(with(too_many), &stored),
            Err(AppError::ScanSettingsTooLarge)
        ));

        let too_long = format!(r"D:\{}", "я".repeat(MAX_SCAN_PATH_CHARS));
        assert!(matches!(
            normalize_scan_settings(with(vec![too_long]), &stored),
            Err(AppError::ScanSettingsTooLarge)
        ));
    }

    #[test]
    fn the_availability_rollback_flag_comes_from_disk_not_from_the_window() {
        let rolled_back = catalog::scan_settings::ScanSettings {
            catalog_target_availability_v1: false,
            catalog_portable_fingerprint_v1: false,
            ..catalog::scan_settings::ScanSettings::default()
        };
        let from_window = catalog::scan_settings::ScanSettings {
            catalog_target_availability_v1: true,
            catalog_portable_fingerprint_v1: true,
            ..catalog::scan_settings::ScanSettings::default()
        };

        let normalized = normalize_scan_settings(from_window, &rolled_back).unwrap();

        assert!(!normalized.catalog_target_availability_v1);
    }
}
