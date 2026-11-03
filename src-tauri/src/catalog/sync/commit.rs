use super::document::load_sanitized_document;
use super::scan::ScanCommit;
use crate::app_state::{cached_details_for_catalog, remember_catalog, remember_volumes, AppState};
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
    state.catalog_generation.observe(previous.generation);
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
    document.generation = state
        .catalog_generation
        .next(previous.generation)
        .ok_or_else(|| "Catalog generation exhausted".to_owned())?;
    let delta = published_delta(
        state.inner(),
        document.generation,
        &previous.apps,
        &document.apps,
    );
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
    remember_volumes(state.inner(), &document.volumes);
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

fn published_delta(
    state: &AppState,
    generation: u64,
    previous: &[AppInfo],
    current: &[AppInfo],
) -> crate::catalog::sync::CatalogDelta {
    let mut delta = compute_delta(generation, previous, current);
    if let Ok(availability) = state.published_availability.lock() {
        let existing = delta
            .upserted
            .iter()
            .map(|app| app.id.clone())
            .collect::<std::collections::HashSet<_>>();
        let mut observed_changes = current
            .iter()
            .filter(|app| {
                !existing.contains(&app.id)
                    && availability
                        .get(&app.id)
                        .is_some_and(|published| *published != app.target_availability)
            })
            .cloned()
            .collect::<Vec<_>>();
        delta.summary.updated += observed_changes.len();
        delta.upserted.append(&mut observed_changes);
        delta.upserted.sort_by_cached_key(|app| app.id.clone());
    }
    delta
}

#[cfg(test)]
mod availability_tests {
    use super::*;
    use crate::app_state::cached_app;

    #[test]
    fn delta_tracks_detach_and_return_against_the_published_snapshot() {
        let state = AppState::default();
        let mut online = cached_app("Editor", r"F:\Apps\Editor.exe");
        online.volume_id = Some("12345678".into());
        online.target_availability = Some("target.present".into());
        let mut offline = online.clone();
        offline.target_availability = Some("target.unverifiable.unmounted_volume".into());
        remember_catalog(&state, &[online.clone()]);
        let detached = published_delta(&state, 1, &[online.clone()], &[offline.clone()]);
        assert_eq!(detached.upserted, vec![offline.clone()]);
        remember_catalog(&state, &[offline.clone()]);
        let returned = published_delta(&state, 2, &[online.clone()], &[online.clone()]);
        assert_eq!(returned.upserted, vec![online]);
    }
    #[test]
    fn delta_uses_published_availability_when_disk_already_matches_scan() {
        let state = AppState::default();
        let mut online = cached_app("Editor", r"F:\Apps\Editor.exe");
        online.volume_id = Some("12345678".into());
        online.target_availability = Some("target.present".into());
        let mut offline = online.clone();
        offline.target_availability = Some("target.unverifiable.unmounted_volume".into());
        remember_catalog(&state, &[online.clone()]);
        let detach = published_delta(&state, 1, &[offline.clone()], &[offline.clone()]);
        assert_eq!(detach.upserted, vec![offline.clone()]);
        assert_eq!(detach.summary.updated, 1);
        remember_catalog(&state, &[offline]);
        let reconnect = published_delta(&state, 2, &[online.clone()], &[online.clone()]);
        assert_eq!(reconnect.upserted, vec![online]);
        assert_eq!(reconnect.summary.updated, 1);
    }
}
