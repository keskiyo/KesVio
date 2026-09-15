use super::scan::run_coordinated_scan;
use super::{SyncRequest, WatchScope};
use crate::app_state::AppState;
use crate::catalog::cache::CatalogDiagnostics;
use crate::catalog::source::{SourceErrorKind, SourceHealth};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::Manager;

pub(crate) const RETRY_DELAYS: [Duration; 3] = [
    Duration::from_secs(5),
    Duration::from_secs(20),
    Duration::from_secs(60),
];

#[derive(Debug, Default)]
pub(crate) struct RetryBudget {
    attempts: usize,
    generation: u64,
}

impl RetryBudget {
    pub(crate) fn next_delay(&mut self) -> Option<(Duration, u64)> {
        let delay = *RETRY_DELAYS.get(self.attempts)?;
        self.attempts += 1;
        self.generation += 1;
        Some((delay, self.generation))
    }

    pub(crate) fn reset(&mut self) {
        self.attempts = 0;
        self.generation += 1;
    }

    pub(crate) fn cancel(&mut self) {
        self.generation += 1;
    }

    pub(crate) fn is_current(&self, generation: u64) -> bool {
        self.generation == generation
    }

    #[cfg(test)]
    fn attempts(&self) -> usize {
        self.attempts
    }
}

pub(crate) struct RetryGuard {
    stop: mpsc::Sender<()>,
    thread: Option<JoinHandle<()>>,
}

impl Drop for RetryGuard {
    fn drop(&mut self) {
        let _ = self.stop.send(());
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

pub(super) fn transient_scope(diagnostics: &CatalogDiagnostics) -> Option<WatchScope> {
    let mut scope: Option<WatchScope> = None;
    let mut widen = |next: WatchScope| {
        scope = Some(scope.map_or(next, |current| current.union(next)));
    };
    for source in &diagnostics.sources {
        if let Some(next) = transient_source_scope(source) {
            widen(next);
        }
    }
    if diagnostics.unreachable_folders > 0 {
        widen(WatchScope::PORTABLE);
    }
    scope
}

fn transient_source_scope(source: &SourceHealth) -> Option<WatchScope> {
    if !matches!(
        source.last_error,
        Some(SourceErrorKind::ProviderFailed | SourceErrorKind::TimedOut)
    ) {
        return None;
    }
    Some(match source.key.0.as_str() {
        crate::catalog::source::START_MENU_SOURCE => WatchScope::START_MENU,
        crate::catalog::source::REGISTRY_SOURCE
        | crate::catalog::source::START_APPS_SOURCE
        | crate::catalog::source::INSTALLER_CACHE_SOURCE => WatchScope::REGISTRY,
        "portable" => WatchScope::PORTABLE,
        _ => WatchScope::ALL,
    })
}

pub(super) fn schedule(
    budget: &Arc<Mutex<RetryBudget>>,
    delay: Duration,
    generation: u64,
    fire: impl FnOnce() + Send + 'static,
) -> RetryGuard {
    let (stop, stopped) = mpsc::channel::<()>();
    let budget = Arc::clone(budget);
    let thread = std::thread::spawn(move || {
        if !matches!(stopped.recv_timeout(delay), Err(RecvTimeoutError::Timeout)) {
            return;
        }
        let current = budget
            .lock()
            .map(|budget| budget.is_current(generation))
            .unwrap_or(false);
        if current {
            fire();
        }
    });
    RetryGuard {
        stop,
        thread: Some(thread),
    }
}

pub(crate) fn cancel_pending(state: &AppState) {
    if let Ok(mut budget) = state.retry_budget.lock() {
        budget.cancel();
    }
    replace_guard(state, None);
}

fn replace_guard(state: &AppState, next: Option<RetryGuard>) {
    let previous = state
        .scan_retry
        .lock()
        .ok()
        .and_then(|mut slot| std::mem::replace(&mut *slot, next));
    drop(previous);
}

pub(super) fn after_scan(
    app: &tauri::AppHandle,
    request: SyncRequest,
    diagnostics: &CatalogDiagnostics,
) {
    let state = app.state::<AppState>();
    let Some(scope) = transient_scope(diagnostics) else {
        if let Ok(mut budget) = state.retry_budget.lock() {
            budget.reset();
        }
        return;
    };
    let planned = state
        .retry_budget
        .lock()
        .ok()
        .and_then(|mut budget| budget.next_delay());
    let Some((delay, generation)) = planned else {
        log::warn!(
            "Scan retry budget exhausted after {} attempts (request={request:?}): waiting for a manual refresh or a returning resource",
            RETRY_DELAYS.len()
        );
        return;
    };
    log::info!(
        "Scan retry scheduled in {}s for scope {scope:?} after request={request:?} (unreachable folders={})",
        delay.as_secs(),
        diagnostics.unreachable_folders
    );
    let handle = app.clone();
    let guard = schedule(&state.retry_budget, delay, generation, move || {
        log::info!("Scan retry firing for scope {scope:?}");
        let _ = run_coordinated_scan(&handle, SyncRequest::Watch(scope), false);
    });
    replace_guard(state.inner(), Some(guard));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::source::{SourceHealthState, SourceKey};
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn health(key: &str, error: Option<SourceErrorKind>) -> SourceHealth {
        SourceHealth {
            key: SourceKey(key.into()),
            state: if error.is_some() {
                SourceHealthState::Stale
            } else {
                SourceHealthState::Fresh
            },
            last_attempt_at: Some(1),
            last_success_at: Some(1),
            consecutive_failures: 0,
            last_duration_ms: Some(1),
            last_error: error,
            record_count: 0,
        }
    }

    fn diagnostics(sources: Vec<SourceHealth>, unreachable_folders: usize) -> CatalogDiagnostics {
        CatalogDiagnostics {
            sources,
            unreachable_folders,
            ..CatalogDiagnostics::default()
        }
    }

    #[test]
    fn only_a_transient_failure_or_an_unreachable_folder_asks_for_a_retry() {
        assert_eq!(
            transient_scope(&diagnostics(vec![health("start-apps", None)], 0)),
            None
        );
        assert_eq!(
            transient_scope(&diagnostics(
                vec![health("start-apps", Some(SourceErrorKind::Cancelled))],
                0
            )),
            None,
            "a cancelled stage is the user's decision, not a transient failure"
        );
        assert_eq!(
            transient_scope(&diagnostics(
                vec![health("portable", Some(SourceErrorKind::EntryLimit))],
                0
            )),
            None,
            "a bound that was hit will be hit again"
        );
        assert_eq!(
            transient_scope(&diagnostics(
                vec![health("start-apps", Some(SourceErrorKind::ProviderFailed))],
                0
            )),
            Some(WatchScope::REGISTRY)
        );
        assert_eq!(
            transient_scope(&diagnostics(
                vec![health("start-menu", Some(SourceErrorKind::TimedOut))],
                0
            )),
            Some(WatchScope::START_MENU)
        );
        assert_eq!(
            transient_scope(&diagnostics(vec![], 2)),
            Some(WatchScope::PORTABLE)
        );
        assert_eq!(
            transient_scope(&diagnostics(
                vec![health("steam", Some(SourceErrorKind::ProviderFailed))],
                0
            )),
            Some(WatchScope::ALL)
        );
    }

    #[test]
    fn several_failed_sources_share_one_retry_scope() {
        let scope = transient_scope(&diagnostics(
            vec![
                health("start-menu", Some(SourceErrorKind::TimedOut)),
                health("registry", Some(SourceErrorKind::ProviderFailed)),
            ],
            1,
        ))
        .expect("a scope");

        assert!(scope.contains(WatchScope::START_MENU));
        assert!(scope.contains(WatchScope::REGISTRY));
        assert!(scope.contains(WatchScope::PORTABLE));
    }

    #[test]
    fn the_budget_allows_three_attempts_with_growing_delays_then_waits_for_a_success() {
        let mut budget = RetryBudget::default();

        let delays = (0..5)
            .map(|_| budget.next_delay().map(|(delay, _)| delay))
            .collect::<Vec<_>>();

        assert_eq!(
            delays,
            vec![
                Some(Duration::from_secs(5)),
                Some(Duration::from_secs(20)),
                Some(Duration::from_secs(60)),
                None,
                None
            ]
        );
        budget.reset();
        assert_eq!(budget.attempts(), 0);
        assert_eq!(
            budget.next_delay().map(|(delay, _)| delay),
            Some(Duration::from_secs(5))
        );
    }

    #[test]
    fn a_reset_or_a_cancel_invalidates_the_attempt_that_was_planned() {
        let mut budget = RetryBudget::default();
        let (_, generation) = budget.next_delay().expect("an attempt");
        assert!(budget.is_current(generation));

        budget.cancel();
        assert!(!budget.is_current(generation));

        let (_, next) = budget.next_delay().expect("an attempt");
        budget.reset();
        assert!(!budget.is_current(next));
    }

    #[test]
    fn a_scheduled_retry_fires_once_after_its_delay_while_its_generation_is_current() {
        let budget = Arc::new(Mutex::new(RetryBudget::default()));
        let (_, generation) = budget.lock().unwrap().next_delay().unwrap();
        let fired = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&fired);

        let mut guard = schedule(&budget, Duration::from_millis(20), generation, move || {
            counter.fetch_add(1, Ordering::SeqCst);
        });
        drop(guard.thread.take().map(|thread| thread.join()));

        assert_eq!(fired.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn a_retry_whose_generation_was_superseded_does_not_fire() {
        let budget = Arc::new(Mutex::new(RetryBudget::default()));
        let (_, generation) = budget.lock().unwrap().next_delay().unwrap();
        let fired = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&fired);
        budget.lock().unwrap().reset();

        let mut guard = schedule(&budget, Duration::from_millis(20), generation, move || {
            counter.fetch_add(1, Ordering::SeqCst);
        });
        drop(guard.thread.take().map(|thread| thread.join()));

        assert_eq!(fired.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn dropping_the_guard_stops_a_pending_retry_before_it_fires() {
        let budget = Arc::new(Mutex::new(RetryBudget::default()));
        let (_, generation) = budget.lock().unwrap().next_delay().unwrap();
        let fired = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&fired);
        let started = std::time::Instant::now();

        let guard = schedule(&budget, Duration::from_secs(30), generation, move || {
            counter.fetch_add(1, Ordering::SeqCst);
        });
        drop(guard);

        assert_eq!(fired.load(Ordering::SeqCst), 0);
        assert!(
            started.elapsed() < Duration::from_secs(5),
            "the drop must not wait out the delay"
        );
    }
}
