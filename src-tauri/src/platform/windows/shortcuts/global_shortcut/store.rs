use super::binding::Binding;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::{fs, io};

const SETTINGS_FILE: &str = "global-shortcut.json";
const TEMPORARY_FILE: &str = "global-shortcut.json.tmp";
const SETTINGS_VERSION: u32 = 1;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredShortcut {
    version: u32,
    binding: Binding,
}

pub(crate) fn read(app_data_dir: &Path) -> Binding {
    fs::read(app_data_dir.join(SETTINGS_FILE))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<StoredShortcut>(&bytes).ok())
        .filter(|stored| stored.version == SETTINGS_VERSION)
        .map(|stored| stored.binding)
        .filter(|binding| binding.validate().is_ok())
        .unwrap_or_default()
}

pub(crate) fn write(app_data_dir: &Path, binding: &Binding) -> io::Result<()> {
    if read_stored(app_data_dir).as_ref() == Some(binding) {
        return Ok(());
    }
    fs::create_dir_all(app_data_dir)?;
    let bytes = serde_json::to_vec_pretty(&StoredShortcut {
        version: SETTINGS_VERSION,
        binding: binding.clone(),
    })
    .map_err(io::Error::other)?;
    let temporary = app_data_dir.join(TEMPORARY_FILE);
    fs::write(&temporary, bytes)?;
    fs::rename(temporary, app_data_dir.join(SETTINGS_FILE))
}

fn read_stored(app_data_dir: &Path) -> Option<Binding> {
    let bytes = fs::read(app_data_dir.join(SETTINGS_FILE)).ok()?;
    let stored = serde_json::from_slice::<StoredShortcut>(&bytes).ok()?;
    (stored.version == SETTINGS_VERSION && stored.binding.validate().is_ok())
        .then_some(stored.binding)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_a_binding() {
        let dir = tempfile::tempdir().unwrap();
        let binding = Binding {
            win: false,
            ctrl: true,
            alt: true,
            shift: false,
            key: "Digit8".into(),
        };

        write(dir.path(), &binding).unwrap();

        assert_eq!(read(dir.path()), binding);
    }

    #[test]
    fn a_changed_binding_replaces_the_stored_value() {
        let dir = tempfile::tempdir().unwrap();
        write(dir.path(), &Binding::default()).unwrap();
        let changed = Binding {
            win: false,
            ctrl: true,
            alt: true,
            shift: false,
            key: "KeyP".into(),
        };

        write(dir.path(), &changed).unwrap();

        assert_eq!(read(dir.path()), changed);
    }

    #[test]
    fn missing_malformed_future_or_invalid_settings_use_the_default() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(read(dir.path()), Binding::default());

        for contents in [
            "not json",
            r#"{"version":99,"binding":{"win":true,"ctrl":false,"alt":false,"shift":false,"key":"KeyA"}}"#,
            r#"{"version":1,"binding":{"win":false,"ctrl":false,"alt":false,"shift":false,"key":"KeyA"}}"#,
        ] {
            std::fs::write(dir.path().join(SETTINGS_FILE), contents).unwrap();
            assert_eq!(read(dir.path()), Binding::default());
        }
    }
}
