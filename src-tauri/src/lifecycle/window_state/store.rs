use super::geometry::WindowGeometry;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::{fs, io};

const WINDOW_STATE_FILE: &str = "window-state.json";
const WINDOW_STATE_TEMPORARY_FILE: &str = "window-state.json.tmp";
const WINDOW_STATE_VERSION: u32 = 1;

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

pub(crate) fn write(app_data_dir: &Path, preferences: &WindowPreferences) -> io::Result<bool> {
    if stored_matches(app_data_dir, preferences) {
        return Ok(false);
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
    fs::rename(temporary, app_data_dir.join(WINDOW_STATE_FILE))?;
    Ok(true)
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
        assert!(write(dir.path(), &saved).unwrap());
        let path = dir.path().join(WINDOW_STATE_FILE);
        let written_at = fs::metadata(&path).unwrap().modified().unwrap();

        assert!(!write(dir.path(), &saved).unwrap());

        assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), written_at);
    }

    #[test]
    fn a_resized_window_reaches_the_stored_state_without_a_close() {
        let dir = tempfile::tempdir().unwrap();
        let before = WindowPreferences {
            geometry: Some(geometry(100, 100, 1250, 720)),
            hide_to_tray: true,
        };
        assert!(write(dir.path(), &before).unwrap());
        let after = WindowPreferences {
            geometry: Some(geometry(100, 100, 430, 658)),
            hide_to_tray: true,
        };

        assert!(write(dir.path(), &after).unwrap());

        assert_eq!(read(dir.path()), after);
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
}
