use crate::app_state::{remember_catalog, remember_volumes, AppState};
use crate::catalog;
use crate::catalog::sync::{load_observed_document, restart_change_watcher, start_volume_watcher};
use crate::paths;
use crate::platform::windows::{global_shortcut, install_registry};
use tauri::{AppHandle, Manager};

pub(crate) fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let _ = tauri::async_runtime::spawn_blocking(move || {
            register_global_shortcut(&app);
            load_cached_catalog(&app);
            start_volume_watcher(app.clone());
            sync_install_registry(&app);
        })
        .await;
    });
}

fn register_global_shortcut(app: &AppHandle) {
    let binding = paths::data_dir(app)
        .ok()
        .map(|directory| global_shortcut::read(&directory))
        .unwrap_or_default();
    let state = app.state::<AppState>();
    if let Ok(mut status) = state.shortcut_status.lock() {
        *status = global_shortcut::Status::pending(&binding);
    }
    let registered = global_shortcut::register(app.clone(), binding);
    super::set_tray_shortcut(
        app,
        registered
            .status
            .available
            .then(|| registered.status.label.clone()),
    );
    if let Ok(mut status) = state.shortcut_status.lock() {
        *status = registered.status;
    }
    if let Some(guard) = registered.guard {
        if let Ok(mut current) = state.global_shortcut.lock() {
            *current = Some(guard);
        }
    }
}

fn load_cached_catalog(app: &AppHandle) {
    let Ok(app_data_dir) = paths::data_dir(app) else {
        return;
    };
    load_cached_catalog_into_state(app.state::<AppState>().inner(), &app_data_dir);
    let settings = catalog::scan_settings::read(&app_data_dir);
    restart_change_watcher(app.clone(), &settings);
}

fn load_cached_catalog_into_state(state: &AppState, app_data_dir: &std::path::Path) {
    let _guard = state.lock_sync();
    if let Some(document) = load_observed_document(app_data_dir) {
        remember_catalog(state, &document.apps);
        remember_volumes(state, &document.volumes);
    }
}

fn sync_install_registry(app: &AppHandle) {
    let Some(install_dir) = install_registry::installed_copy_dir() else {
        return;
    };
    let config = app.config();
    let publisher = config.bundle.publisher.clone().unwrap_or_default();
    let product = config.product_name.clone().unwrap_or_default();
    install_registry::sync_install_dir(&publisher, &product, &install_dir);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{mpsc, Arc};
    use std::time::Duration;

    #[test]
    fn cache_publication_waits_for_an_in_progress_commit() {
        let state = Arc::new(AppState::default());
        let directory = tempfile::tempdir().unwrap();
        let lock = state.lock_sync();
        let worker_state = Arc::clone(&state);
        let path = directory.path().to_owned();
        let (started, waiting) = mpsc::channel();
        let (finished, done) = mpsc::channel();
        let worker = std::thread::spawn(move || {
            started.send(()).unwrap();
            load_cached_catalog_into_state(&worker_state, &path);
            finished.send(()).unwrap();
        });
        waiting.recv().unwrap();
        assert!(done.recv_timeout(Duration::from_millis(100)).is_err());
        drop(lock);
        done.recv_timeout(Duration::from_secs(5)).unwrap();
        worker.join().unwrap();
    }
}
