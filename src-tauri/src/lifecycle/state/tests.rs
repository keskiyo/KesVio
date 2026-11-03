use super::*;

fn geometry() -> WindowGeometry {
    WindowGeometry {
        x: 200,
        y: 150,
        width: 1250,
        height: 720,
        maximized: false,
    }
}

#[test]
fn normal_close_hides_the_window() {
    let state = LifecycleState::default();
    assert!(state.should_hide_on_close());
}

#[test]
fn explicit_quit_disables_close_interception() {
    let state = LifecycleState::default();
    state.mark_quitting();
    assert!(!state.should_hide_on_close());
}

#[test]
fn turning_the_tray_setting_off_makes_close_end_the_program() {
    let state = LifecycleState::default();
    assert!(state.hides_to_tray());
    assert!(state.should_hide_on_close());

    state.set_hides_to_tray(false);

    assert!(!state.should_hide_on_close());
}

#[test]
fn quitting_overrides_the_tray_setting_in_both_directions() {
    let state = LifecycleState::default();
    state.set_hides_to_tray(true);
    state.mark_quitting();

    assert!(!state.should_hide_on_close());
}

#[test]
fn a_fresh_session_has_no_geometry_to_restore() {
    assert_eq!(LifecycleState::default().geometry(), None);
}

#[test]
fn every_geometry_change_advances_the_generation() {
    let state = LifecycleState::default();
    assert_eq!(state.geometry_changes(), 0);

    assert_eq!(state.note_geometry_change(), 1);
    assert_eq!(state.note_geometry_change(), 2);

    assert_eq!(state.geometry_changes(), 2);
}

#[test]
fn only_one_persist_is_pending_at_a_time() {
    let state = LifecycleState::default();

    assert!(state.claim_persist());
    assert!(!state.claim_persist());

    state.release_persist();

    assert!(state.claim_persist());
}

#[test]
fn a_fresh_session_is_not_a_quiet_start() {
    let state = LifecycleState::default();
    assert!(!state.quiet_start());
    assert!(!state.end_quiet_start());
    assert!(!state.wait_out_quiet_start(Duration::from_secs(1)));
}

#[test]
fn a_quiet_start_ends_exactly_once() {
    let state = LifecycleState::default();
    state.begin_quiet_start();
    assert!(state.quiet_start());

    assert!(state.end_quiet_start());
    assert!(!state.quiet_start());
    assert!(!state.end_quiet_start());
}

#[test]
fn ending_a_quiet_start_releases_a_deferred_scan() {
    let state = std::sync::Arc::new(LifecycleState::default());
    state.begin_quiet_start();
    let releaser = std::sync::Arc::clone(&state);
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(10));
        releaser.end_quiet_start();
    });
    let started = std::time::Instant::now();

    assert!(state.wait_out_quiet_start(Duration::from_secs(5)));
    assert!(started.elapsed() < Duration::from_secs(5));
}

#[test]
fn the_latest_remembered_geometry_wins() {
    let state = LifecycleState::default();
    state.remember_geometry(geometry());
    state.remember_geometry(WindowGeometry {
        maximized: true,
        ..geometry()
    });

    assert_eq!(
        state.geometry(),
        Some(WindowGeometry {
            maximized: true,
            ..geometry()
        })
    );
}
