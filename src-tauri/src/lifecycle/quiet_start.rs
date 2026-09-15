use std::sync::{Condvar, Mutex, PoisonError};
use std::time::Duration;

pub(crate) const STARTUP_SCAN_DELAY: Duration = Duration::from_secs(60);

#[derive(Default)]
pub(crate) struct QuietStartGate {
    woken: Mutex<bool>,
    wake: Condvar,
}

impl QuietStartGate {
    pub(crate) fn wait(&self, timeout: Duration) -> bool {
        let guard = self.woken.lock().unwrap_or_else(PoisonError::into_inner);
        let (guard, _) = self
            .wake
            .wait_timeout_while(guard, timeout, |woken| !*woken)
            .unwrap_or_else(PoisonError::into_inner);
        *guard
    }

    pub(crate) fn wake(&self) {
        *self.woken.lock().unwrap_or_else(PoisonError::into_inner) = true;
        self.wake.notify_all();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::time::Instant;

    #[test]
    fn an_unwoken_gate_returns_after_the_timeout() {
        let gate = QuietStartGate::default();
        let started = Instant::now();

        assert!(!gate.wait(Duration::from_millis(30)));
        assert!(started.elapsed() >= Duration::from_millis(30));
    }

    #[test]
    fn a_wake_from_another_thread_ends_the_wait_early() {
        let gate = Arc::new(QuietStartGate::default());
        let waker = Arc::clone(&gate);
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(10));
            waker.wake();
        });
        let started = Instant::now();

        assert!(gate.wait(Duration::from_secs(5)));
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn a_wake_issued_before_the_wait_is_not_lost() {
        let gate = QuietStartGate::default();
        gate.wake();

        assert!(gate.wait(Duration::from_secs(5)));
    }
}
