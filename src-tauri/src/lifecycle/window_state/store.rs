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

pub(super) fn write(app_data_dir: &Path, preferences: &WindowPreferences) -> io::Result<bool> {
    let path = app_data_dir.join(WINDOW_STATE_FILE);
    let mut document = match fs::read(&path) {
        Ok(bytes) => serde_json::from_slice::<serde_json::Value>(&bytes)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        Err(error) if error.kind() == io::ErrorKind::NotFound => serde_json::Map::new(),
        Err(error) => return Err(error),
    };
    if document
        .get("version")
        .and_then(serde_json::Value::as_u64)
        .is_some_and(|version| version > u64::from(WINDOW_STATE_VERSION))
    {
        return Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Unsupported window state version",
        ));
    }
    if serde_json::from_value::<StoredWindowState>(document.clone().into())
        .ok()
        .is_some_and(|stored| {
            stored.version == WINDOW_STATE_VERSION
                && stored.geometry == preferences.geometry
                && stored.hide_to_tray == preferences.hide_to_tray
        })
    {
        return Ok(false);
    }
    document.insert("version".into(), WINDOW_STATE_VERSION.into());
    document.insert("hideToTray".into(), preferences.hide_to_tray.into());
    let mut geometry = document
        .remove("geometry")
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let updated = serde_json::to_value(preferences.geometry).map_err(io::Error::other)?;
    let updated = if let serde_json::Value::Object(updated) = updated {
        geometry.extend(updated);
        geometry.into()
    } else {
        updated
    };
    document.insert("geometry".into(), updated);
    fs::create_dir_all(app_data_dir)?;
    let bytes = serde_json::to_vec_pretty(&document).map_err(io::Error::other)?;
    let temporary = app_data_dir.join(WINDOW_STATE_TEMPORARY_FILE);
    fs::write(&temporary, bytes)?;
    fs::rename(temporary, path)?;
    Ok(true)
}

#[cfg(test)]
mod tests;
