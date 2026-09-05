use super::state::LifecycleState;
use crate::paths;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::{fs, io};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

const WINDOW_STATE_FILE: &str = "window-state.json";
const WINDOW_STATE_TEMPORARY_FILE: &str = "window-state.json.tmp";
const WINDOW_STATE_VERSION: u32 = 1;
const MIN_WIDTH: u32 = 560;
const MIN_HEIGHT: u32 = 520;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub maximized: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ScreenRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct WindowPreferences {
    pub geometry: Option<WindowGeometry>,
    pub hide_to_tray: bool,
}

impl Default for WindowPreferences {
    fn default() -> Self {
        Self {
            geometry: None,
            hide_to_tray: hides_to_tray_by_default(),
        }
    }
}

fn hides_to_tray_by_default() -> bool {
    true
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredWindowState {
    version: u32,
    #[serde(default)]
    geometry: Option<WindowGeometry>,
    #[serde(default = "hides_to_tray_by_default")]
    hide_to_tray: bool,
}

pub(crate) fn read(app_data_dir: &Path) -> WindowPreferences {
    let Ok(bytes) = fs::read(app_data_dir.join(WINDOW_STATE_FILE)) else {
        return WindowPreferences::default();
    };
    let Ok(stored) = serde_json::from_slice::<StoredWindowState>(&bytes) else {
        return WindowPreferences::default();
    };
    if stored.version != WINDOW_STATE_VERSION {
        return WindowPreferences::default();
    }
    WindowPreferences {
        geometry: stored.geometry,
        hide_to_tray: stored.hide_to_tray,
    }
}

pub(crate) fn write(app_data_dir: &Path, preferences: &WindowPreferences) -> io::Result<()> {
    if stored_matches(app_data_dir, preferences) {
        return Ok(());
    }
    fs::create_dir_all(app_data_dir)?;
    let bytes = serde_json::to_vec_pretty(&StoredWindowState {
        version: WINDOW_STATE_VERSION,
        geometry: preferences.geometry,
        hide_to_tray: preferences.hide_to_tray,
    })
    .map_err(io::Error::other)?;
    let temporary = app_data_dir.join(WINDOW_STATE_TEMPORARY_FILE);
    fs::write(&temporary, bytes)?;
    fs::rename(temporary, app_data_dir.join(WINDOW_STATE_FILE))
}

fn stored_matches(app_data_dir: &Path, preferences: &WindowPreferences) -> bool {
    fs::read(app_data_dir.join(WINDOW_STATE_FILE))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<StoredWindowState>(&bytes).ok())
        .filter(|stored| stored.version == WINDOW_STATE_VERSION)
        .is_some_and(|stored| {
            stored.geometry == preferences.geometry
                && stored.hide_to_tray == preferences.hide_to_tray
        })
}

fn overlap_area(geometry: &WindowGeometry, screen: &ScreenRect) -> u64 {
    let left = geometry.x.max(screen.x);
    let top = geometry.y.max(screen.y);
    let right = geometry
        .x
        .saturating_add(geometry.width as i32)
        .min(screen.x.saturating_add(screen.width as i32));
    let bottom = geometry
        .y
        .saturating_add(geometry.height as i32)
        .min(screen.y.saturating_add(screen.height as i32));
    if right <= left || bottom <= top {
        return 0;
    }
    u64::from(right.abs_diff(left)) * u64::from(bottom.abs_diff(top))
}

pub(crate) fn fit_to_screens(
    geometry: WindowGeometry,
    screens: &[ScreenRect],
) -> Option<WindowGeometry> {
    let mut fitted = geometry;
    fitted.width = fitted.width.max(MIN_WIDTH);
    fitted.height = fitted.height.max(MIN_HEIGHT);
    let home = screens
        .iter()
        .max_by_key(|screen| overlap_area(&fitted, screen))?;
    if overlap_area(&fitted, home) == 0 {
        return None;
    }
    fitted.width = fitted.width.min(home.width);
    fitted.height = fitted.height.min(home.height);
    let rightmost = home
        .x
        .saturating_add(home.width as i32)
        .saturating_sub(fitted.width as i32);
    let lowest = home
        .y
        .saturating_add(home.height as i32)
        .saturating_sub(fitted.height as i32);
    fitted.x = fitted.x.clamp(home.x, rightmost.max(home.x));
    fitted.y = fitted.y.clamp(home.y, lowest.max(home.y));
    Some(fitted)
}

fn merged_geometry(
    previous: Option<WindowGeometry>,
    minimized: bool,
    maximized: bool,
    current: WindowGeometry,
) -> Option<WindowGeometry> {
    if minimized {
        return previous;
    }
    if maximized {
        if let Some(previous) = previous {
            return Some(WindowGeometry {
                maximized: true,
                ..previous
            });
        }
    }
    Some(WindowGeometry {
        maximized,
        ..current
    })
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
    let _ = write(&app_data_dir, &preferences_of(lifecycle));
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
        return;
    };
    let _ = window.set_position(PhysicalPosition::new(fitted.x, fitted.y));
    let _ = window.set_size(PhysicalSize::new(fitted.width, fitted.height));
    if fitted.maximized {
        let _ = window.maximize();
    }
    lifecycle.remember_geometry(fitted);
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
mod tests {
    use super::*;

    fn geometry(x: i32, y: i32, width: u32, height: u32) -> WindowGeometry {
        WindowGeometry {
            x,
            y,
            width,
            height,
            maximized: false,
        }
    }

    fn primary() -> ScreenRect {
        ScreenRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }
    }

    #[test]
    fn round_trips_the_stored_preferences() {
        let dir = tempfile::tempdir().unwrap();
        let saved = WindowPreferences {
            geometry: Some(WindowGeometry {
                x: 120,
                y: 64,
                width: 1250,
                height: 720,
                maximized: true,
            }),
            hide_to_tray: false,
        };

        write(dir.path(), &saved).unwrap();

        assert_eq!(read(dir.path()), saved);
    }

    #[test]
    fn rewriting_the_same_preferences_leaves_the_file_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let saved = WindowPreferences::default();
        write(dir.path(), &saved).unwrap();
        let path = dir.path().join(WINDOW_STATE_FILE);
        let written_at = fs::metadata(&path).unwrap().modified().unwrap();

        write(dir.path(), &saved).unwrap();

        assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), written_at);
    }

    #[test]
    fn a_corrupt_or_future_document_is_replaced_rather_than_kept() {
        let dir = tempfile::tempdir().unwrap();
        let saved = WindowPreferences::default();

        fs::write(dir.path().join(WINDOW_STATE_FILE), "not json").unwrap();
        write(dir.path(), &saved).unwrap();
        assert_eq!(read(dir.path()), saved);

        fs::write(
            dir.path().join(WINDOW_STATE_FILE),
            br#"{"version":99,"hideToTray":false}"#,
        )
        .unwrap();
        write(dir.path(), &saved).unwrap();
        assert_eq!(read(dir.path()), saved);
    }

    #[test]
    fn missing_corrupt_or_future_state_falls_back_to_the_configured_window() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(read(dir.path()), WindowPreferences::default());

        fs::write(dir.path().join(WINDOW_STATE_FILE), "not json").unwrap();
        assert_eq!(read(dir.path()), WindowPreferences::default());

        fs::write(
            dir.path().join(WINDOW_STATE_FILE),
            br#"{"version":99,"geometry":{"x":0,"y":0,"width":1250,"height":720}}"#,
        )
        .unwrap();
        assert_eq!(read(dir.path()), WindowPreferences::default());
    }

    #[test]
    fn closing_hides_to_tray_until_the_user_says_otherwise() {
        let dir = tempfile::tempdir().unwrap();
        assert!(WindowPreferences::default().hide_to_tray);
        assert!(read(dir.path()).hide_to_tray);

        fs::write(
            dir.path().join(WINDOW_STATE_FILE),
            br#"{"version":1,"geometry":{"x":0,"y":0,"width":1250,"height":720}}"#,
        )
        .unwrap();
        assert!(read(dir.path()).hide_to_tray);
    }

    #[test]
    fn a_window_that_never_moved_still_stores_the_close_setting() {
        let dir = tempfile::tempdir().unwrap();
        let saved = WindowPreferences {
            geometry: None,
            hide_to_tray: false,
        };

        write(dir.path(), &saved).unwrap();

        assert_eq!(read(dir.path()), saved);
    }

    #[test]
    fn a_geometry_inside_a_monitor_is_kept_unchanged() {
        let saved = geometry(200, 150, 1250, 720);

        assert_eq!(fit_to_screens(saved, &[primary()]), Some(saved));
    }

    #[test]
    fn a_window_from_a_disconnected_monitor_is_rejected() {
        let saved = geometry(3000, 200, 1250, 720);

        assert_eq!(fit_to_screens(saved, &[primary()]), None);
        assert_eq!(fit_to_screens(saved, &[]), None);
    }

    #[test]
    fn a_window_hanging_off_the_edge_is_pulled_back_onto_its_monitor() {
        let saved = geometry(1800, 1000, 1250, 720);

        let fitted = fit_to_screens(saved, &[primary()]).expect("a sliver still overlaps");

        assert_eq!(fitted.x, 1920 - 1250);
        assert_eq!(fitted.y, 1080 - 720);
        assert_eq!((fitted.width, fitted.height), (1250, 720));
    }

    #[test]
    fn a_window_larger_than_its_monitor_is_clamped_to_it() {
        let saved = geometry(-40, -30, 3000, 2000);

        let fitted = fit_to_screens(saved, &[primary()]).expect("the window overlaps the monitor");

        assert_eq!((fitted.x, fitted.y), (0, 0));
        assert_eq!((fitted.width, fitted.height), (1920, 1080));
    }

    #[test]
    fn a_geometry_below_the_minimum_size_grows_to_it() {
        let saved = geometry(10, 10, 120, 90);

        let fitted = fit_to_screens(saved, &[primary()]).expect("the window overlaps the monitor");

        assert_eq!((fitted.width, fitted.height), (MIN_WIDTH, MIN_HEIGHT));
    }

    #[test]
    fn a_secondary_monitor_keeps_its_own_window() {
        let secondary = ScreenRect {
            x: -1600,
            y: 120,
            width: 1600,
            height: 900,
        };
        let saved = geometry(-1400, 200, 1250, 720);

        assert_eq!(fit_to_screens(saved, &[primary(), secondary]), Some(saved));
    }

    #[test]
    fn maximizing_keeps_the_restore_rectangle_instead_of_the_full_screen_one() {
        let restored = geometry(200, 150, 1250, 720);
        let full_screen = geometry(0, 0, 1920, 1080);

        let merged = merged_geometry(Some(restored), false, true, full_screen);

        assert_eq!(
            merged,
            Some(WindowGeometry {
                maximized: true,
                ..restored
            })
        );
    }

    #[test]
    fn minimizing_keeps_the_last_known_geometry() {
        let restored = geometry(200, 150, 1250, 720);
        let off_screen = geometry(-32000, -32000, 1250, 720);

        assert_eq!(
            merged_geometry(Some(restored), true, false, off_screen),
            Some(restored)
        );
        assert_eq!(merged_geometry(None, true, false, off_screen), None);
    }

    #[test]
    fn a_first_maximize_without_history_still_records_a_geometry() {
        let full_screen = geometry(0, 0, 1920, 1080);

        assert_eq!(
            merged_geometry(None, false, true, full_screen),
            Some(WindowGeometry {
                maximized: true,
                ..full_screen
            })
        );
    }

    #[test]
    fn the_maximized_flag_survives_fitting() {
        let saved = WindowGeometry {
            maximized: true,
            ..geometry(200, 150, 1250, 720)
        };

        assert_eq!(
            fit_to_screens(saved, &[primary()]).map(|fitted| fitted.maximized),
            Some(true)
        );
    }
}
