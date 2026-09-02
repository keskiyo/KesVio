use crate::app_state::{remember_catalog, AppState};
use crate::catalog;
use crate::catalog::sync::{load_sanitized_cache, restart_change_watcher};
use crate::platform::windows::{global_shortcut, install_registry};
use tauri::{AppHandle, Manager};

pub(crate) fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let _ = tauri::async_runtime::spawn_blocking(move || {
            register_global_shortcut(&app);
            load_cached_catalog(&app);
            sync_install_registry(&app);
        })
        .await;
    });
}

fn register_global_shortcut(app: &AppHandle) {
    let registered = global_shortcut::register(app.clone());
    let state = app.state::<AppState>();
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
    let Ok(app_data_dir) = app.path().app_data_dir() else {
        return;
    };
    if let Some(apps) = load_sanitized_cache(&app_data_dir) {
        let state = app.state::<AppState>();
        remember_catalog(state.inner(), &apps);
    }
    let settings = catalog::scan_settings::read(&app_data_dir);
    restart_change_watcher(app.clone(), &settings);
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
