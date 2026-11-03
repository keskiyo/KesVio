mod geometry;
mod persistence;
mod store;
mod writer;
pub(crate) use geometry::{fit_to_screens, MinimumSize, ScreenRect, WindowGeometry};
pub(crate) use persistence::{persist, persist_when_settled};
use store::read;
pub(crate) use writer::WindowStateWriter;

use super::state::LifecycleState;
use crate::paths;
use geometry::merged_geometry;
use std::path::Path;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

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

fn physical_minimum(logical: Option<f64>, scale: f64) -> u32 {
    let scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    };
    logical
        .filter(|value| value.is_finite() && *value > 0.0)
        .map(|value| (value * scale).round().min(f64::from(u32::MAX)) as u32)
        .unwrap_or(0)
}

fn configured_minimum(window: &WebviewWindow) -> MinimumSize {
    let scale = window.scale_factor().unwrap_or(1.0);
    let (width, height) = window
        .app_handle()
        .config()
        .app
        .windows
        .iter()
        .find(|configured| configured.label == window.label())
        .map_or((None, None), |configured| {
            (configured.min_width, configured.min_height)
        });
    MinimumSize {
        width: physical_minimum(width, scale),
        height: physical_minimum(height, scale),
    }
}

fn restore(window: &WebviewWindow, app_data_dir: &Path, lifecycle: &LifecycleState) {
    let stored = read(app_data_dir);
    lifecycle.set_hides_to_tray(stored.hide_to_tray);
    let minimum = configured_minimum(window);
    let Some(fitted) = stored
        .geometry
        .and_then(|geometry| fit_to_screens(geometry, &screen_rects(window), minimum))
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

#[cfg(test)]
mod tests;
