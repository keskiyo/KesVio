use super::scan::run_coordinated_scan;
use crate::app_state::AppState;
use crate::catalog;
use crate::catalog::sync::watch_paths::WatchRoot;
use crate::catalog::sync::{SyncRequest, WatchScope};
use crate::platform::windows::change_watcher::{self, ChangeOrigin};
use std::sync::Arc;
use tauri::Manager;

pub(crate) fn restart_change_watcher(
    app: tauri::AppHandle,
    settings: &catalog::scan_settings::ScanSettings,
) {
    let state = app.state::<AppState>();
    let previous = state
        .change_watcher
        .lock()
        .ok()
        .and_then(|mut current| current.take());
    drop(previous);
    let roots = catalog::watcher_paths(settings);
    let paths = roots.iter().map(|root| root.path.clone()).collect();
    let callback_handle = app.clone();
    let callback = Arc::new(move |origins: Vec<ChangeOrigin>| {
        let scope = scope_for_origins(&origins, &roots);
        let handle = callback_handle.clone();
        tauri::async_runtime::spawn(async move {
            let _ = tauri::async_runtime::spawn_blocking(move || {
                run_coordinated_scan(&handle, SyncRequest::Watch(scope), false)
            })
            .await;
        });
    });
    let watcher = change_watcher::start(paths, callback);
    if let Ok(mut current) = state.change_watcher.lock() {
        *current = watcher;
    };
}

fn scope_for_origins(origins: &[ChangeOrigin], roots: &[WatchRoot]) -> WatchScope {
    let mut selected = None;
    for origin in origins {
        let scope = match origin {
            ChangeOrigin::Registry => WatchScope::REGISTRY,
            ChangeOrigin::Unknown => return WatchScope::ALL,
            ChangeOrigin::Directory(path) => roots
                .iter()
                .find(|root| {
                    root.path
                        .to_string_lossy()
                        .eq_ignore_ascii_case(&path.to_string_lossy())
                })
                .map_or(WatchScope::ALL, |root| root.scope),
        };
        selected = Some(selected.map_or(scope, |current: WatchScope| current.union(scope)));
    }
    selected.unwrap_or(WatchScope::ALL)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_origin_requests_full_watch_coverage() {
        assert_eq!(
            scope_for_origins(&[ChangeOrigin::Unknown], &[]),
            WatchScope::ALL
        );
    }
}
