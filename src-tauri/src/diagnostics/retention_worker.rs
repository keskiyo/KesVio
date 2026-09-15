use super::retention::{prune_expired_logs, MAX_LOG_AGE};
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread::JoinHandle;
use std::time::{Duration, SystemTime};

const INTERVAL: Duration = Duration::from_secs(60);

pub(crate) struct RetentionWorker {
    stop: mpsc::Sender<()>,
    thread: Option<JoinHandle<()>>,
}

impl RetentionWorker {
    pub(crate) fn start(directory: PathBuf) -> Option<Self> {
        Self::start_with_interval(directory, INTERVAL)
    }

    fn start_with_interval(directory: PathBuf, interval: Duration) -> Option<Self> {
        let (stop, stopped) = mpsc::channel();
        let thread = std::thread::Builder::new()
            .name("log-retention".into())
            .spawn(move || {
                let mut last_failed = 0;
                loop {
                    let pruned = prune_expired_logs(&directory, SystemTime::now(), MAX_LOG_AGE);
                    if pruned.failed > 0 && pruned.failed != last_failed {
                        log::warn!(
                            "Log retention: {} expired file(s) could not be removed yet",
                            pruned.failed
                        );
                    }
                    last_failed = pruned.failed;
                    if stopped.recv_timeout(interval) != Err(mpsc::RecvTimeoutError::Timeout) {
                        break;
                    }
                }
            })
            .ok()?;
        Some(Self {
            stop,
            thread: Some(thread),
        })
    }

    pub(crate) fn stop(&mut self) {
        let _ = self.stop.send(());
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

impl Drop for RetentionWorker {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn the_worker_prunes_at_once_and_stops_promptly() {
        let directory = tempfile::tempdir().unwrap();
        let expired = directory.path().join("kesvio-1000-1.log");
        std::fs::write(&expired, "@1 old\n").unwrap();

        let mut worker = RetentionWorker::start_with_interval(
            directory.path().to_path_buf(),
            Duration::from_secs(60),
        )
        .expect("a thread can be spawned");
        let deadline = Instant::now() + Duration::from_secs(5);
        while expired.exists() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        let started = Instant::now();
        worker.stop();

        assert!(
            !expired.exists(),
            "the first pass runs without waiting for the interval"
        );
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn the_worker_keeps_pruning_on_its_interval() {
        let directory = tempfile::tempdir().unwrap();
        let worker = RetentionWorker::start_with_interval(
            directory.path().to_path_buf(),
            Duration::from_millis(20),
        )
        .expect("a thread can be spawned");
        let expired = directory.path().join("kesvio-1000-1.log");
        std::fs::write(&expired, "@1 old\n").unwrap();

        let deadline = Instant::now() + Duration::from_secs(5);
        while expired.exists() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }

        assert!(!expired.exists());
        drop(worker);
    }
}
