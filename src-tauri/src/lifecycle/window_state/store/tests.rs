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
fn a_corrupt_document_can_be_replaced_with_safe_defaults() {
    let dir = tempfile::tempdir().unwrap();
    let saved = WindowPreferences::default();

    fs::write(dir.path().join(WINDOW_STATE_FILE), "not json").unwrap();
    write(dir.path(), &saved).unwrap();
    assert_eq!(read(dir.path()), saved);
}

#[test]
fn a_future_document_is_never_overwritten() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(WINDOW_STATE_FILE);
    let future = br#"{"version":99,"hideToTray":false,"newPreference":"keep"}"#;
    fs::write(&path, future).unwrap();

    assert!(write(dir.path(), &WindowPreferences::default()).is_err());
    assert_eq!(fs::read(&path).unwrap(), future);
}

#[test]
fn updating_preferences_preserves_unknown_document_and_geometry_fields() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(WINDOW_STATE_FILE);
    fs::write(&path, br#"{"version":1,"hideToTray":true,"newPreference":{"value":42},"geometry":{"x":0,"y":0,"width":1250,"height":720,"maximized":false,"scale":1.5}}"#).unwrap();
    let preferences = WindowPreferences {
        geometry: Some(geometry(100, 80, 900, 700)),
        hide_to_tray: false,
    };

    write(dir.path(), &preferences).unwrap();

    let saved: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    assert_eq!(saved["newPreference"]["value"], 42);
    assert_eq!(saved["geometry"]["scale"], 1.5);
    assert_eq!(read(dir.path()), preferences);
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
