use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::MenuItem;
use tauri::{AppHandle, Emitter, Manager, Wry};

pub(crate) const FORCE_SCAN_EVENT: &str = "tray://force-full-scan";
pub(super) const FORCE_SCAN_ID: &str = "force-full-scan";

#[derive(Default)]
struct TrayScanState {
    item: Mutex<Option<MenuItem<Wry>>>,
    enabled: AtomicBool,
}

pub(super) fn create_item(app: &AppHandle) -> tauri::Result<MenuItem<Wry>> {
    app.manage(TrayScanState::default());
    let enabled = app.state::<TrayScanState>().enabled.load(Ordering::SeqCst);
    MenuItem::with_id(app, FORCE_SCAN_ID, label(!enabled), enabled, None::<&str>)
}

pub(super) fn remember_item(app: &AppHandle, item: MenuItem<Wry>) {
    let previous = app
        .state::<TrayScanState>()
        .item
        .lock()
        .ok()
        .and_then(|mut stored| stored.replace(item));
    drop(previous);
}

fn current_item(app: &AppHandle) -> Option<MenuItem<Wry>> {
    app.try_state::<TrayScanState>()
        .and_then(|state| state.item.lock().ok()?.clone())
}

fn update(item: &MenuItem<Wry>, busy: bool) -> tauri::Result<()> {
    item.set_enabled(!busy)?;
    item.set_text(label(busy))
}

fn label(busy: bool) -> &'static str {
    if busy {
        "Scanning…"
    } else {
        "Force scan"
    }
}

pub(crate) fn apply_state(app: &AppHandle, busy: bool) {
    let handle = app.clone();
    if let Err(error) = app.run_on_main_thread(move || {
        if let Some(state) = handle.try_state::<TrayScanState>() {
            state.enabled.store(!busy, Ordering::SeqCst);
        }
        if let Some(item) = current_item(&handle) {
            if let Err(error) = update(&item, busy) {
                log::error!("Could not update tray scan state: {error}");
            }
        }
    }) {
        log::error!("Could not reach the main thread for tray scan state: {error}");
    }
}

pub(super) fn request(app: &AppHandle) {
    let Some(item) = current_item(app) else {
        return;
    };
    let Some(state) = app.try_state::<TrayScanState>() else {
        return;
    };
    if !state.enabled.swap(false, Ordering::SeqCst) {
        return;
    }
    if let Err(error) = update(&item, true) {
        log::error!("Could not disable tray scan action: {error}");
        return;
    }
    crate::lifecycle::show_main_window(app);
    if let Err(error) = app.emit(FORCE_SCAN_EVENT, ()) {
        log::error!("Could not dispatch tray full scan: {error}");
        state.enabled.store(true, Ordering::SeqCst);
        if let Err(error) = update(&item, false) {
            log::error!("Could not restore tray scan action: {error}");
        }
    }
}
