use cadence::LogCadence;
use std::sync::{Arc, Condvar, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

mod cadence;

const POLL_INTERVAL: Duration = Duration::from_secs(1);
const STALL_AFTER: Duration = Duration::from_secs(10);
const REPEAT_AFTER: Duration = Duration::from_secs(30);

struct Step {
    stage: &'static str,
    detail: String,
    since: Instant,
    reported: Option<Duration>,
    cadence: LogCadence,
}

impl Step {
    fn new() -> Self {
        Self {
            stage: "",
            detail: String::new(),
            since: Instant::now(),
            reported: None,
            cadence: LogCadence::default(),
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
        let Some(slot) = &self.step else {
            return;
        };
        let now = Instant::now();
        let log_turn = {
            let Ok(mut step) = slot.lock() else {
                return;
            };
            step.stage = stage;
            step.detail.clear();
            step.detail
                .extend(detail.chars().filter(|c| !c.is_control()).take(512));
            step.since = now;
            step.reported = None;
            if self.verbose {
                step.cadence.turn(stage, now)
            } else {
                None
            }
        };
        let Some(skipped) = log_turn else {
            return;
        };
        let detail = detail
            .chars()
            .filter(|c| !c.is_control())
            .take(512)
            .collect::<String>();
        let thread = std::thread::current().id();
        if skipped == 0 {
            log::info!("Scan step {stage}: {detail} thread={thread:?}");
        } else {
            log::info!("Scan step {stage}: {detail} thread={thread:?} skipped={skipped}");
        }
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
            .map_err(|error| log::error!("Scan watchdog unavailable: kind={:?}", error.kind()))
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
            verbose: true,
        }
    }
}

impl Drop for ScanWatchdog {
    fn drop(&mut self) {
        if std::thread::panicking() {
            let last = self.step.lock().ok().map(|step| {
                (
                    step.stage,
                    step.detail.clone(),
                    step.since.elapsed().as_millis(),
                )
            });
            if let Some((stage, detail, elapsed)) = last {
                log::error!("Scan unwinding: stage={stage} detail={detail} elapsedMs={elapsed}");
            }
        }
        self.shutdown.stop();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
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
mod tests;
