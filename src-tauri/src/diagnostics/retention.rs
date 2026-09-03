use std::path::Path;
use std::time::{Duration, SystemTime};

pub(crate) const MAX_LOG_AGE: Duration = Duration::from_secs(3 * 24 * 60 * 60);

pub(crate) fn prune_expired_logs(directory: &Path, now: SystemTime, max_age: Duration) -> usize {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return 0;
    };
    let mut removed = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if !is_log_file(&path) {
            continue;
        }
        let Ok(modified) = entry.metadata().and_then(|metadata| metadata.modified()) else {
            continue;
        };
        if is_expired(modified, now, max_age) && std::fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }
    removed
}

fn is_log_file(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("log"))
}

fn is_expired(modified: SystemTime, now: SystemTime, max_age: Duration) -> bool {
    now.duration_since(modified).is_ok_and(|age| age > max_age)
}

#[cfg(test)]
mod tests {
    use super::{is_expired, prune_expired_logs, MAX_LOG_AGE};
    use std::time::{Duration, SystemTime};

    #[test]
    fn a_file_written_in_the_future_never_counts_as_expired() {
        let now = SystemTime::now();
        let written_later = now + Duration::from_secs(60);

        assert!(!is_expired(written_later, now, MAX_LOG_AGE));
        assert!(!is_expired(now, now, MAX_LOG_AGE));
    }

    #[test]
    fn expiry_starts_after_the_age_limit_rather_than_at_it() {
        let now = SystemTime::now();

        assert!(!is_expired(now - MAX_LOG_AGE, now, MAX_LOG_AGE));
        assert!(is_expired(
            now - MAX_LOG_AGE - Duration::from_secs(1),
            now,
            MAX_LOG_AGE
        ));
    }

    #[test]
    fn pruning_removes_stale_logs_and_leaves_everything_else_alone() {
        let directory = tempfile::tempdir().unwrap();
        let stale = directory.path().join("appnook_2026-01-01.log");
        let cache = directory.path().join("apps-cache.json");
        std::fs::write(&stale, "old").unwrap();
        std::fs::write(&cache, "{}").unwrap();
        let much_later = SystemTime::now() + MAX_LOG_AGE + Duration::from_secs(60);

        assert_eq!(
            prune_expired_logs(directory.path(), much_later, MAX_LOG_AGE),
            1
        );
        assert!(!stale.exists());
        assert!(cache.exists());
    }

    #[test]
    fn a_fresh_log_survives_and_a_missing_directory_is_not_an_error() {
        let directory = tempfile::tempdir().unwrap();
        let fresh = directory.path().join("appnook.log");
        std::fs::write(&fresh, "new").unwrap();

        assert_eq!(
            prune_expired_logs(directory.path(), SystemTime::now(), MAX_LOG_AGE),
            0
        );
        assert!(fresh.exists());
        assert_eq!(
            prune_expired_logs(
                &directory.path().join("absent"),
                SystemTime::now(),
                MAX_LOG_AGE
            ),
            0
        );
    }
}
