mod geometry;
mod store;

pub(crate) use geometry::{fit_to_screens, ScreenRect, WindowGeometry};
pub(crate) use store::{read, write, WindowPreferences};

use super::state::LifecycleState;
use crate::paths;
use geometry::merged_geometry;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

const PERSIST_SETTLE_DELAY: Duration = Duration::from_millis(500);
const PERSIST_SETTLE_ROUNDS: u32 = 20;

fn describe(geometry: Option<WindowGeometry>) -> String {
    match geometry {
        Some(geometry) => format!(
            "{}x{} at ({},{}) maximized={}",
            geometry.width, geometry.height, geometry.x, geometry.y, geometry.maximized
        ),
        None => "none".to_owned(),
    }
}

fn capture(window: &WebviewWindow, previous: Option<WindowGeometry>) -> Option<WindowGeometry> {
    let minimized = window.is_minimized().unwrap_or(false);
    if minimized {
        return previous;
    }
    let position = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;
    merged_geometry(
        previous,
        minimized,
        window.is_maximized().unwrap_or(false),
        WindowGeometry {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            maximized: false,
        },
    )
}

pub(crate) fn remember(app: &AppHandle, lifecycle: &LifecycleState) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Some(geometry) = capture(&window, lifecycle.geometry()) {
        lifecycle.remember_geometry(geometry);
    }
}

pub(crate) fn preferences_of(lifecycle: &LifecycleState) -> WindowPreferences {
    WindowPreferences {
        geometry: lifecycle.geometry(),
        hide_to_tray: lifecycle.hides_to_tray(),
    }
}

pub(crate) fn persist(app: &AppHandle, lifecycle: &LifecycleState) {
    let Ok(app_data_dir) = paths::data_dir(app) else {
        return;
    };
    let preferences = preferences_of(lifecycle);
    match write(&app_data_dir, &preferences) {
        Ok(true) => log::info!("Window state persisted: {}", describe(preferences.geometry)),
        Ok(false) => {}
        Err(error) => log::warn!("Window state was not persisted: {error}"),
    }
}

pub(crate) fn persist_when_settled(app: &AppHandle, lifecycle: &Arc<LifecycleState>) {
    lifecycle.note_geometry_change();
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
        lifecycle.release_persist();
        persist(&app, &lifecycle);
    });
}

fn screen_rects(window: &WebviewWindow) -> Vec<ScreenRect> {
    window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|monitor| ScreenRect {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
        })
        .collect()
}

fn restore(window: &WebviewWindow, app_data_dir: &Path, lifecycle: &LifecycleState) {
    let stored = read(app_data_dir);
    lifecycle.set_hides_to_tray(stored.hide_to_tray);
    let Some(fitted) = stored
        .geometry
        .and_then(|geometry| fit_to_screens(geometry, &screen_rects(window)))
    else {
        log::info!(
            "Window state not restored: stored {}, using the configured window",
            describe(stored.geometry)
        );
        return;
    };
    let _ = window.set_position(PhysicalPosition::new(fitted.x, fitted.y));
    let _ = window.set_size(PhysicalSize::new(fitted.width, fitted.height));
    if fitted.maximized {
        let _ = window.maximize();
    }
    lifecycle.remember_geometry(fitted);
    log::info!(
        "Window state restored: stored {}, applied {}, window reports {}",
        describe(stored.geometry),
        describe(Some(fitted)),
        describe(capture(window, None))
    );
}

pub(crate) fn restore_main_window(app: &AppHandle, lifecycle: &LifecycleState) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Ok(app_data_dir) = paths::data_dir(app) {
        restore(&window, &app_data_dir, lifecycle);
    }
}
