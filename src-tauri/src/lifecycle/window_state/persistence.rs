use super::LifecycleState;
use crate::paths;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;

const PERSIST_SETTLE_DELAY: Duration = Duration::from_millis(500);
const PERSIST_SETTLE_ROUNDS: u32 = 20;

pub(crate) fn persist(app: &AppHandle, lifecycle: &LifecycleState) {
    let Ok(app_data_dir) = paths::data_dir(app) else {
        return;
    };
    match lifecycle.persist_window_preferences(&app_data_dir, None) {
        Ok(true) => log::info!("Window state persisted"),
        Ok(false) => {}
        Err(error) => log::warn!("Window state was not persisted: {error}"),
    }
}

pub(crate) fn persist_when_settled(app: &AppHandle, lifecycle: &Arc<LifecycleState>) {
    lifecycle.note_geometry_change();
    schedule_persist(app, lifecycle);
}

fn schedule_persist(app: &AppHandle, lifecycle: &Arc<LifecycleState>) {
    if !lifecycle.claim_persist() {
        return;
    }
    let app = app.clone();
    let lifecycle = Arc::clone(lifecycle);
    tauri::async_runtime::spawn_blocking(move || {
        let mut seen = lifecycle.geometry_changes();
        for _ in 0..PERSIST_SETTLE_ROUNDS {
            std::thread::sleep(PERSIST_SETTLE_DELAY);
            let latest = lifecycle.geometry_changes();
            if latest == seen {
                break;
            }
            seen = latest;
        }
        let generation = lifecycle.geometry_changes();
        persist(&app, &lifecycle);
        lifecycle.release_persist();
        if lifecycle.geometry_changes() != generation {
            schedule_persist(&app, &lifecycle);
        }
    });
}
