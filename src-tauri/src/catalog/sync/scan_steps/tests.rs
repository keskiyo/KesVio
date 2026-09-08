use super::*;
fn step_of(detail: &str, reported: Option<Duration>) -> Step {
    Step {
        stage: "registry",
        detail: detail.into(),
        since: Instant::now(),
        reported,
    }
}

#[test]
fn a_step_younger_than_the_threshold_is_not_a_stall() {
    let step = step_of("Editor", None);

    assert_eq!(
        stalled_for(&step, step.since + Duration::from_secs(9)),
        None
    );
}

#[test]
fn a_step_that_outlives_the_threshold_is_reported_once() {
    let step = step_of("Editor", None);
    let now = step.since + Duration::from_secs(11);

    let waited = stalled_for(&step, now).expect("the first report is due");

    assert_eq!(waited, Duration::from_secs(11));
    assert_eq!(
        stalled_for(&step_of("Editor", Some(waited)), now),
        None,
        "the same step is not reported again straight away"
    );
}

#[test]
fn a_stall_that_persists_is_reported_again_after_the_repeat_interval() {
    let reported = Duration::from_secs(11);
    let step = step_of("Editor", Some(reported));

    assert_eq!(
        stalled_for(&step, step.since + reported + REPEAT_AFTER),
        Some(reported + REPEAT_AFTER)
    );
}

#[test]
fn an_empty_step_is_never_a_stall() {
    let step = step_of("", None);

    assert_eq!(
        stalled_for(&step, step.since + Duration::from_secs(600)),
        None
    );
}

#[test]
fn a_reported_stall_marks_its_step_so_the_next_poll_stays_quiet() {
    let slot = Mutex::new(step_of("Editor", None));
    let now = slot.lock().unwrap().since + Duration::from_secs(11);

    let reported = pending_stall(&slot, now).expect("the first report is due");

    assert_eq!(
        reported,
        ("registry", "Editor".to_string(), Duration::from_secs(11))
    );
    assert_eq!(pending_stall(&slot, now), None);
    assert_eq!(
        slot.lock().unwrap().reported,
        Some(Duration::from_secs(11)),
        "the step remembers what was already said about it"
    );
}

#[test]
fn a_step_that_advances_clears_the_pending_report() {
    let watchdog = ScanWatchdog::start();
    let slot = Arc::clone(&watchdog.step);
    let now = slot.lock().unwrap().since + Duration::from_secs(11);
    watchdog.tracker().mark("registry", "Editor");
    assert!(pending_stall(&slot, now).is_some());

    watchdog.tracker().mark("registry", "Viewer");

    assert_eq!(slot.lock().unwrap().reported, None);
}

#[test]
fn an_inert_tracker_records_nothing_and_does_not_panic() {
    StepTracker::default().mark("registry", "Editor");
}

#[test]
fn a_live_tracker_replaces_the_detail_without_reallocating_it() {
    let watchdog = ScanWatchdog::start();
    let tracker = watchdog.tracker();

    tracker.mark("registry", "a long entry name that reserves capacity");
    let capacity = watchdog.step.lock().unwrap().detail.capacity();
    tracker.mark("start-menu", "short");

    let step = watchdog.step.lock().unwrap();
    assert_eq!(step.stage, "start-menu");
    assert_eq!(step.detail, "short");
    assert_eq!(step.detail.capacity(), capacity);
    assert_eq!(step.reported, None);
}

#[test]
fn a_finished_watchdog_stops_its_thread_without_waiting_for_the_next_poll() {
    let started_at = Instant::now();

    drop(ScanWatchdog::start());

    assert!(started_at.elapsed() < POLL_INTERVAL);
}

#[test]
fn a_live_tracker_logs_steps_without_command_line_flags() {
    crate::diagnostics::test_log::capture(|| {
        ScanWatchdog::start()
            .tracker()
            .mark("start-apps", "package registry");
        assert!(crate::diagnostics::test_log::lines()
            .iter()
            .any(|line| { line.starts_with("Scan step start-apps: package registry thread=") }));
    });
}

#[test]
fn logged_step_details_cannot_inject_lines_or_grow_without_bound() {
    crate::diagnostics::test_log::capture(|| {
        ScanWatchdog::start()
            .tracker()
            .mark("start-apps", &format!("a\r\n{}", "я".repeat(1000)));
        let lines = crate::diagnostics::test_log::lines();
        assert_eq!(lines.len(), 1);
        assert!(!lines[0].contains(['\r', '\n']));
        assert_eq!(lines[0].matches('я').count(), 511);
    });
}
