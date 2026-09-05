use std::sync::{Arc, Condvar, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

const POLL_INTERVAL: Duration = Duration::from_secs(1);
const STALL_AFTER: Duration = Duration::from_secs(10);
const REPEAT_AFTER: Duration = Duration::from_secs(30);

struct Step {
    stage: &'static str,
    detail: String,
    since: Instant,
    reported: Option<Duration>,
}

impl Step {
    fn new() -> Self {
        Self {
            stage: "",
            detail: String::new(),
            since: Instant::now(),
            reported: None,
        }
    }
}

#[derive(Default)]
struct Shutdown {
    stopped: Mutex<bool>,
    signal: Condvar,
}

impl Shutdown {
    fn wait(&self, timeout: Duration) -> bool {
        let Ok(stopped) = self.stopped.lock() else {
            return true;
        };
        if *stopped {
            return true;
        }
        let Ok((stopped, _)) = self.signal.wait_timeout(stopped, timeout) else {
            return true;
        };
        *stopped
    }

    fn stop(&self) {
        if let Ok(mut stopped) = self.stopped.lock() {
            *stopped = true;
        }
        self.signal.notify_all();
    }
}

#[derive(Clone, Default)]
pub(crate) struct StepTracker {
    step: Option<Arc<Mutex<Step>>>,
    verbose: bool,
}

impl StepTracker {
    pub(crate) fn mark(&self, stage: &'static str, detail: &str) {
        if self.verbose {
            log::info!("Scan step {stage}: {detail}");
        }
        let Some(slot) = &self.step else {
            return;
        };
        let Ok(mut step) = slot.lock() else {
            return;
        };
        step.stage = stage;
        step.detail.clear();
        step.detail.push_str(detail);
        step.since = Instant::now();
        step.reported = None;
    }

    #[cfg(test)]
    pub(crate) fn current(&self) -> Option<(&'static str, String)> {
        let step = self.step.as_ref()?.lock().ok()?;
        Some((step.stage, step.detail.clone()))
    }
}

pub(crate) struct ScanWatchdog {
    step: Arc<Mutex<Step>>,
    shutdown: Arc<Shutdown>,
    thread: Option<JoinHandle<()>>,
}

impl ScanWatchdog {
    pub(crate) fn start() -> Self {
        let step = Arc::new(Mutex::new(Step::new()));
        let shutdown = Arc::new(Shutdown::default());
        let watched = Arc::clone(&step);
        let finished = Arc::clone(&shutdown);
        let thread = std::thread::Builder::new()
            .name("scan-watchdog".into())
            .spawn(move || {
                while !finished.wait(POLL_INTERVAL) {
                    report_stall(&watched, Instant::now());
                }
            })
            .ok();
        Self {
            step,
            shutdown,
            thread,
        }
    }

    pub(crate) fn tracker(&self) -> StepTracker {
        StepTracker {
            step: Some(Arc::clone(&self.step)),
            verbose: verbose_steps_requested(std::env::args_os()),
        }
    }
}

impl Drop for ScanWatchdog {
    fn drop(&mut self) {
        self.shutdown.stop();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn verbose_steps_requested(arguments: impl Iterator<Item = std::ffi::OsString>) -> bool {
    arguments.skip(1).any(|argument| {
        argument
            .to_str()
            .is_some_and(|argument| argument.eq_ignore_ascii_case("--verbose-scan"))
    })
}

fn report_stall(slot: &Mutex<Step>, now: Instant) {
    let Some((stage, detail, waited)) = pending_stall(slot, now) else {
        return;
    };
    log::warn!("Scan stalled {}s in {stage}: {detail}", waited.as_secs());
}

fn pending_stall(slot: &Mutex<Step>, now: Instant) -> Option<(&'static str, String, Duration)> {
    let mut step = slot.lock().ok()?;
    let waited = stalled_for(&step, now)?;
    step.reported = Some(waited);
    Some((step.stage, step.detail.clone(), waited))
}

fn stalled_for(step: &Step, now: Instant) -> Option<Duration> {
    if step.detail.is_empty() {
        return None;
    }
    let waited = now.saturating_duration_since(step.since);
    if waited < STALL_AFTER {
        return None;
    }
    if step
        .reported
        .is_some_and(|reported| waited < reported + REPEAT_AFTER)
    {
        return None;
    }
    Some(waited)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;

    fn arguments(values: &[&str]) -> std::vec::IntoIter<OsString> {
        values
            .iter()
            .map(OsString::from)
            .collect::<Vec<_>>()
            .into_iter()
    }

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
    fn only_the_verbose_flag_turns_on_per_step_logging() {
        assert!(verbose_steps_requested(arguments(&[
            "KesVio.exe",
            "--verbose-scan"
        ])));
        assert!(verbose_steps_requested(arguments(&[
            "KesVio.exe",
            "--VERBOSE-SCAN"
        ])));
        assert!(!verbose_steps_requested(arguments(&[
            "KesVio.exe",
            "--autostart"
        ])));
        assert!(!verbose_steps_requested(arguments(&["--verbose-scan"])));
    }
}
