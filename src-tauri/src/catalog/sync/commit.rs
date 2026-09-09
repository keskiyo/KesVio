use super::document::load_sanitized_document;
use super::scan::ScanCommit;
use crate::app_state::{cached_details_for_catalog, remember_catalog, AppState};
use crate::catalog::cache;
use crate::catalog::scan_coordinator::ScanJob;
use crate::catalog::sync::compute_delta;
use crate::catalog::{self, AppInfo};
use crate::error::AppError;
use tauri::{Emitter, Manager};

pub(super) struct ScanOutcome {
    pub(super) apps: Vec<AppInfo>,
    pub(super) generation: u64,
    pub(super) diagnostics: Option<crate::catalog::cache::CatalogDiagnostics>,
    pub(super) delta: crate::catalog::sync::CatalogDelta,
    pub(super) app_data_dir: std::path::PathBuf,
}

pub(super) fn write_catalog_under_lock(
    app: &tauri::AppHandle,
    job: &ScanJob<ScanCommit>,
) -> Result<ScanOutcome, AppError> {
    let _operation = crate::diagnostics::Operation::start("catalog persistence transaction");
    let watchdog = super::scan_steps::ScanWatchdog::start();
    let steps = watchdog.tracker();
    let state = app.state::<AppState>();
    steps.mark("commit", "waiting for synchronization lock");
    let _guard = state.lock_sync();
    steps.mark("commit", "synchronization lock acquired");
    steps.mark("commit", "resolving data directory");
    let app_data_dir = crate::paths::data_dir(app)
        .map_err(|error| format!("Could not open the application data folder: {error}"))?;
    steps.mark("commit", "loading previous document");
    let previous = load_sanitized_document(&app_data_dir).unwrap_or_default();
    log::info!(
        "Catalog persistence: previous generation={} records={}",
        previous.generation,
        previous.apps.len()
    );
    steps.mark("commit", "loading scan settings");
    let settings = catalog::scan_settings::read(&app_data_dir);
    let mut document = catalog::sync::synchronize(
        &previous,
        &settings,
        job.request,
        |progress| {
            let _ = app.emit("scan://progress", progress);
        },
        || job.cancelled.load(std::sync::atomic::Ordering::Relaxed),
        &steps,
    );
    if job.cancelled.load(std::sync::atomic::Ordering::Relaxed) {
        log::warn!("Catalog persistence: scan cancelled before commit");
        return Err(AppError::ScanCancelled);
    }
    steps.mark("commit", "merging cached details");
    document.app_details =
        cached_details_for_catalog(state.inner(), &document.apps, document.app_details);
    steps.mark("commit", "computing delta");
    let delta = compute_delta(document.generation, &previous.apps, &document.apps);
    log::info!(
        "Catalog persistence: writing document generation={} records={}",
        document.generation,
        document.apps.len()
    );
    steps.mark("commit", "writing document");
    cache::write_document(&app_data_dir, &document)
        .map_err(|error| format!("Could not save the application cache: {error}"))?;
    steps.mark("commit", "document saved, updating in-memory catalog");
    remember_catalog(state.inner(), &document.apps);
    let live_ids = document
        .apps
        .iter()
        .map(|app| app.id.clone())
        .collect::<Vec<_>>();
    steps.mark("commit", "pruning icon cache");
    catalog::icon_cache::retain_only(&app_data_dir, &live_ids);
    steps.mark("commit", "pruning logs");
    prune_expired_logs(app);
    log::info!(
        "Catalog persistence: committed generation={}",
        document.generation
    );
    Ok(ScanOutcome {
        apps: document.apps,
        generation: document.generation,
        diagnostics: document.diagnostics,
        delta,
        app_data_dir,
    })
}

fn prune_expired_logs(app: &tauri::AppHandle) {
    let Ok(log_dir) = crate::paths::log_dir(app) else {
        return;
    };
    crate::diagnostics::prune_expired_logs(
        &log_dir,
        std::time::SystemTime::now(),
        crate::diagnostics::MAX_LOG_AGE,
    );
}
