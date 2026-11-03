use super::super::store::read;
use super::*;
use std::sync::{mpsc, Arc};
use std::time::Duration;

#[test]
fn a_geometry_write_cannot_overwrite_a_successful_close_preference() {
    let directory = tempfile::tempdir().unwrap();
    let lifecycle = Arc::new(LifecycleState::default());
    let writer = Arc::new(WindowStateWriter::default());
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let geometry = {
        let lifecycle = Arc::clone(&lifecycle);
        let writer = Arc::clone(&writer);
        let path = directory.path().to_owned();
        std::thread::spawn(move || {
            writer.write_with(&lifecycle, None, |preferences| {
                started_tx.send(()).unwrap();
                release_rx.recv_timeout(Duration::from_secs(5)).unwrap();
                write(&path, preferences)
            })
        })
    };
    started_rx.recv_timeout(Duration::from_secs(5)).unwrap();
    let (saved_tx, saved_rx) = mpsc::channel();
    let preference = {
        let lifecycle = Arc::clone(&lifecycle);
        let writer = Arc::clone(&writer);
        let path = directory.path().to_owned();
        std::thread::spawn(move || {
            let result = writer.write(&lifecycle, &path, Some(false));
            saved_tx.send(()).unwrap();
            result
        })
    };
    let _ = saved_rx.recv_timeout(Duration::from_millis(100));
    release_tx.send(()).unwrap();
    geometry.join().unwrap().unwrap();
    preference.join().unwrap().unwrap();

    assert!(!read(directory.path()).hide_to_tray);
    assert!(!lifecycle.hides_to_tray());
}

#[test]
fn a_failed_older_preference_cannot_revert_a_successful_newer_preference() {
    let directory = tempfile::tempdir().unwrap();
    let lifecycle = Arc::new(LifecycleState::default());
    let writer = Arc::new(WindowStateWriter::default());
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let failing = {
        let lifecycle = Arc::clone(&lifecycle);
        let writer = Arc::clone(&writer);
        std::thread::spawn(move || {
            writer.write_with(&lifecycle, Some(true), |_| {
                started_tx.send(()).unwrap();
                release_rx.recv_timeout(Duration::from_secs(5)).unwrap();
                Err(io::Error::other("controlled write failure"))
            })
        })
    };
    started_rx.recv_timeout(Duration::from_secs(5)).unwrap();
    let (saved_tx, saved_rx) = mpsc::channel();
    let successful = {
        let lifecycle = Arc::clone(&lifecycle);
        let writer = Arc::clone(&writer);
        let path = directory.path().to_owned();
        std::thread::spawn(move || {
            let result = writer.write(&lifecycle, &path, Some(false));
            saved_tx.send(()).unwrap();
            result
        })
    };
    let _ = saved_rx.recv_timeout(Duration::from_millis(100));
    release_tx.send(()).unwrap();
    assert!(failing.join().unwrap().is_err());
    successful.join().unwrap().unwrap();

    assert!(!lifecycle.hides_to_tray());
    assert!(!read(directory.path()).hide_to_tray);
}

#[test]
fn a_failed_write_keeps_the_last_durable_close_preference() {
    let directory = tempfile::tempdir().unwrap();
    let lifecycle = LifecycleState::default();
    let writer = WindowStateWriter::default();
    writer
        .write(&lifecycle, directory.path(), Some(false))
        .unwrap();

    assert!(writer
        .write_with(&lifecycle, Some(true), |_| {
            Err(io::Error::other("controlled write failure"))
        })
        .is_err());

    assert!(!lifecycle.hides_to_tray());
    assert!(!read(directory.path()).hide_to_tray);
}

#[test]
fn an_unsupported_document_does_not_change_the_active_close_preference() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("window-state.json");
    let future = br#"{"version":2,"hideToTray":false,"extra":[1,2,3]}"#;
    std::fs::write(&path, future).unwrap();
    let lifecycle = LifecycleState::default();

    assert!(lifecycle
        .persist_window_preferences(directory.path(), Some(false))
        .is_err());

    assert!(lifecycle.hides_to_tray());
    assert_eq!(std::fs::read(path).unwrap(), future);
}
