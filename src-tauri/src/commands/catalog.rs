use super::run_blocking;
use crate::app_state::{remember_catalog, remember_volumes, AppState};
use crate::catalog::sync::{
    cancel_pending_retry, load_sanitized_document, run_coordinated_scan, SyncRequest,
};
use crate::catalog::{self, cache, CatalogAppDto};
use crate::error::AppError;
use crate::lifecycle::{LifecycleState, STARTUP_SCAN_DELAY};
use crate::paths;
use serde::Serialize;
use std::sync::Arc;
use std::time::Instant;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CatalogSnapshot {
    apps: Vec<CatalogAppDto>,
    has_cache: bool,
    generation: u64,
    diagnostics: Option<cache::CatalogDiagnostics>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CatalogScanResult {
    apps: Vec<CatalogAppDto>,
    generation: u64,
}

impl From<crate::catalog::sync::ScanCommit> for CatalogScanResult {
    fn from(commit: crate::catalog::sync::ScanCommit) -> Self {
        Self {
            apps: commit.apps.iter().map(CatalogAppDto::from).collect(),
            generation: commit.generation,
        }
    }
}

#[cfg(test)]
pub(super) fn snapshot_sample(app: &crate::catalog::AppInfo) -> CatalogSnapshot {
    CatalogSnapshot {
        apps: vec![CatalogAppDto::from(app)],
        has_cache: true,
        generation: 7,
        diagnostics: None,
    }
}

#[cfg(test)]
pub(super) fn scan_result_sample(app: &crate::catalog::AppInfo) -> CatalogScanResult {
    CatalogScanResult {
        apps: vec![CatalogAppDto::from(app)],
        generation: 7,
    }
}

#[tauri::command]
pub(crate) async fn get_apps(app: tauri::AppHandle) -> Result<CatalogSnapshot, AppError> {
    let app_data_dir =
        paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    let cache_dir = app_data_dir.clone();
    let handle = app.clone();
    let cached = run_blocking("Catalog cache read", move || {
        let state = handle.state::<AppState>();
        let _guard = state.lock_sync();
        let cached = load_sanitized_document(&cache_dir);
        if let Some(document) = &cached {
            state.catalog_generation.observe(document.generation);
            remember_catalog(state.inner(), &document.apps);
            remember_volumes(state.inner(), &document.volumes);
        }
        cached
    })
    .await?;
    let has_cache = cached.is_some();
    let document = cached.unwrap_or_default();
    let generation = document.generation;
    let diagnostics = document.diagnostics.clone();
    let apps = document.apps;
    Ok(CatalogSnapshot {
        has_cache,
        apps: apps.iter().map(CatalogAppDto::from).collect(),
        generation,
        diagnostics,
    })
}

#[tauri::command]
pub(crate) async fn refresh_apps(app: tauri::AppHandle) -> Result<CatalogScanResult, AppError> {
    let commit = tauri::async_runtime::spawn_blocking(move || {
        run_coordinated_scan(&app, SyncRequest::Refresh, true)?.ok_or(AppError::Coalesced {
            what: "Application refresh",
        })
    })
    .await
    .map_err(|error| AppError::Interrupted {
        context: "Application scanning",
        source: error.to_string(),
    })??;
    Ok(CatalogScanResult::from(commit))
}

#[tauri::command]
pub(crate) async fn force_full_scan(app: tauri::AppHandle) -> Result<CatalogScanResult, AppError> {
    let commit = tauri::async_runtime::spawn_blocking(move || {
        run_coordinated_scan(&app, SyncRequest::Force, true)?.ok_or(AppError::Coalesced {
            what: "Application scan",
        })
    })
    .await
    .map_err(|error| AppError::Interrupted {
        context: "Application scanning",
        source: error.to_string(),
    })??;
    Ok(CatalogScanResult::from(commit))
}

#[tauri::command]
pub(crate) async fn reset_catalog_cache(
    app: tauri::AppHandle,
) -> Result<CatalogScanResult, AppError> {
    let commit = tauri::async_runtime::spawn_blocking(move || {
        let app_data_dir =
            paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
        {
            let state = app.state::<AppState>();
            cancel_pending_retry(state.inner());
            state.scan_coordinator.cancel_all();
            let _guard = state.lock_sync();
            if let Some(generation) = cache::stored_generation(&app_data_dir) {
                state.catalog_generation.observe(generation);
            }
            cache::reset(&app_data_dir)
                .map_err(|error| AppError::ResetCatalogCache(error.to_string()))?;
            catalog::icon_cache::clear(&app_data_dir)
                .map_err(|error| AppError::ResetIconCache(error.to_string()))?;
        }
        run_coordinated_scan(&app, SyncRequest::Force, true)?.ok_or(AppError::Coalesced {
            what: "Catalog reset scan",
        })
    })
    .await
    .map_err(|error| AppError::Interrupted {
        context: "Catalog reset",
        source: error.to_string(),
    })??;
    Ok(CatalogScanResult::from(commit))
}

#[tauri::command]
pub(crate) fn start_background_sync(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let handle = app.clone();
        let _ = tauri::async_runtime::spawn_blocking(move || {
            let lifecycle = Arc::clone(&handle.state::<Arc<LifecycleState>>());
            let deferred_since = Instant::now();
            if lifecycle.wait_out_quiet_start(STARTUP_SCAN_DELAY) {
                log::info!(
                    "Startup scan deferred by quiet start: waitedMs={}",
                    deferred_since.elapsed().as_millis()
                );
            }
            run_coordinated_scan(&handle, SyncRequest::Startup, false)
        })
        .await;
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_state::cached_app;

    #[test]
    fn catalog_snapshot_excludes_execution_metadata_from_webview_json() {
        let mut app = cached_app("Editor", r"C:\Editor\editor.exe");
        app.id = "editor".into();
        app.launch_arguments = Some("TOP_SECRET_LAUNCH_ARGUMENTS".into());
        app.resolved_path = Some("TOP_SECRET_RESOLVED_TARGET".into());
        app.shortcut_icon_path = Some("TOP_SECRET_SHORTCUT_ICON".into());

        let json = serde_json::to_value(CatalogSnapshot {
            apps: vec![CatalogAppDto::from(&app)],
            has_cache: true,
            generation: 1,
            diagnostics: None,
        })
        .unwrap();
        let serialized = json.to_string();

        for secret in [
            "TOP_SECRET_LAUNCH_ARGUMENTS",
            "TOP_SECRET_RESOLVED_TARGET",
            "TOP_SECRET_SHORTCUT_ICON",
        ] {
            assert!(!serialized.contains(secret));
        }
        let app = &json["apps"][0];
        assert!(app.get("uninstall").is_none());
        assert!(app.get("launchArguments").is_none());
        assert!(app.get("resolvedPath").is_none());
        assert!(app.get("shortcutIconPath").is_none());
    }

    #[test]
    fn a_scan_result_carries_the_generation_that_produced_it() {
        let mut app = cached_app("Editor", r"C:\Editor\editor.exe");
        app.id = "editor".into();
        app.launch_arguments = Some("TOP_SECRET_SCAN_LAUNCH_ARGUMENTS".into());
        app.resolved_path = Some("TOP_SECRET_SCAN_RESOLVED_TARGET".into());

        let json =
            serde_json::to_value(CatalogScanResult::from(crate::catalog::sync::ScanCommit {
                apps: vec![app],
                generation: 7,
            }))
            .unwrap();

        assert_eq!(json["generation"], 7);
        assert_eq!(json["apps"][0]["id"], "editor");
        for secret in [
            "TOP_SECRET_SCAN_LAUNCH_ARGUMENTS",
            "TOP_SECRET_SCAN_RESOLVED_TARGET",
        ] {
            assert!(!json.to_string().contains(secret));
        }
    }
}
