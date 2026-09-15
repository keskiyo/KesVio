use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

pub(crate) const MAX_LOG_AGE: Duration = Duration::from_secs(2 * 60 * 60);
pub(super) const SEGMENT_SECONDS: u64 = 10 * 60;
const MAX_DIRECTORY_BYTES: u64 = 32 * 1024 * 1024;
const SEGMENT_PREFIX: &str = "kesvio-";

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub(crate) struct Pruned {
    pub(crate) removed: usize,
    pub(crate) failed: usize,
}

pub(crate) fn prune_expired_logs(directory: &Path, now: SystemTime, max_age: Duration) -> Pruned {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return Pruned::default();
    };
    let now_seconds = unix_seconds(now);
    let mut pruned = Pruned::default();
    let mut kept = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !is_log_file(&path) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let modified = metadata.modified().ok();
        let expired = match segment_start(&path) {
            Some(start) => segment_expired(start, now_seconds, max_age),
            None => modified.is_some_and(|modified| is_expired(modified, now, max_age)),
        };
        if expired {
            remove(&path, &mut pruned);
        } else {
            let order = segment_start(&path).unwrap_or_else(|| modified.map_or(0, unix_seconds));
            kept.push((order, path, metadata.len()));
        }
    }
    kept.sort();
    let mut total: u64 = kept.iter().map(|(_, _, size)| *size).sum();
    for (_, path, size) in kept {
        if total <= MAX_DIRECTORY_BYTES {
            break;
        }
        if remove(&path, &mut pruned) {
            total = total.saturating_sub(size);
        }
    }
    pruned
}

pub(super) fn segment_start(path: &Path) -> Option<u64> {
    path.file_stem()?
        .to_str()?
        .strip_prefix(SEGMENT_PREFIX)?
        .split('-')
        .next()?
        .parse()
        .ok()
}

pub(super) fn segment_expired(start: u64, now: u64, max_age: Duration) -> bool {
    if start > now {
        return start - now > max_age.as_secs();
    }
    now - start > max_age.as_secs() + SEGMENT_SECONDS
}

pub(crate) fn unix_seconds(time: SystemTime) -> u64 {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

fn remove(path: &PathBuf, pruned: &mut Pruned) -> bool {
    if std::fs::remove_file(path).is_ok() {
        pruned.removed += 1;
        true
    } else {
        pruned.failed += 1;
        false
    }
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
    use super::*;
    use std::os::windows::fs::OpenOptionsExt;

    fn seconds(value: u64) -> SystemTime {
        SystemTime::UNIX_EPOCH + Duration::from_secs(value)
    }

    #[test]
    fn logs_are_kept_for_two_hours_of_windows_clock_time() {
        assert_eq!(MAX_LOG_AGE, Duration::from_secs(2 * 60 * 60));
        assert_eq!(SEGMENT_SECONDS, 600);
    }

    #[test]
    fn a_segment_expires_once_its_last_possible_event_is_two_hours_old() {
        let start = 100_000;
        let window = MAX_LOG_AGE.as_secs();

        assert!(!segment_expired(
            start,
            start + window + SEGMENT_SECONDS,
            MAX_LOG_AGE
        ));
        assert!(segment_expired(
            start,
            start + window + SEGMENT_SECONDS + 1,
            MAX_LOG_AGE
        ));
    }

    #[test]
    fn a_segment_from_a_clock_moved_forward_is_kept_within_the_window_and_dropped_beyond_it() {
        let now = 100_000;

        assert!(!segment_expired(now + SEGMENT_SECONDS, now, MAX_LOG_AGE));
        assert!(!segment_expired(
            now + MAX_LOG_AGE.as_secs(),
            now,
            MAX_LOG_AGE
        ));
        assert!(segment_expired(
            now + MAX_LOG_AGE.as_secs() + 1,
            now,
            MAX_LOG_AGE
        ));
    }

    #[test]
    fn the_segment_start_is_read_from_the_file_name_only() {
        assert_eq!(
            segment_start(Path::new(r"C:\logs\kesvio-100000-4242.log")),
            Some(100_000)
        );
        assert_eq!(
            segment_start(Path::new("kesvio-100000-4242-3.log")),
            Some(100_000)
        );
        assert_eq!(segment_start(Path::new("kesvio.log")), None);
        assert_eq!(segment_start(Path::new("kesvio_2026-01-01.log")), None);
        assert_eq!(segment_start(Path::new("kesvio-later.log")), None);
    }

    #[test]
    fn pruning_removes_expired_segments_by_name_and_legacy_files_by_modification_time() {
        let directory = tempfile::tempdir().unwrap();
        let expired = directory.path().join("kesvio-1000-1.log");
        let current = directory.path().join("kesvio-100000-1.log");
        let legacy = directory.path().join("kesvio_2026-01-01.log");
        let cache = directory.path().join("apps-cache.json");
        for path in [&expired, &current, &legacy] {
            std::fs::write(path, "@1 line\n").unwrap();
        }
        std::fs::write(&cache, "{}").unwrap();

        let pruned = prune_expired_logs(directory.path(), seconds(100_100), MAX_LOG_AGE);

        assert_eq!(
            pruned,
            Pruned {
                removed: 1,
                failed: 0
            }
        );
        assert!(!expired.exists());
        assert!(current.exists());
        assert!(
            legacy.exists(),
            "a fresh legacy file follows the modification-time rule"
        );
        assert!(cache.exists());
    }

    #[test]
    fn a_stale_legacy_file_still_expires_by_modification_time() {
        let directory = tempfile::tempdir().unwrap();
        let stale = directory.path().join("kesvio.log");
        std::fs::write(&stale, "old").unwrap();
        let much_later = SystemTime::now() + MAX_LOG_AGE + Duration::from_secs(60);

        assert_eq!(
            prune_expired_logs(directory.path(), much_later, MAX_LOG_AGE),
            Pruned {
                removed: 1,
                failed: 0
            }
        );
        assert!(!stale.exists());
    }

    #[test]
    fn the_directory_cap_removes_the_oldest_segments_first() {
        let directory = tempfile::tempdir().unwrap();
        let payload = vec![b'x'; 9 * 1024 * 1024];
        let oldest = directory.path().join("kesvio-100000-1.log");
        let middle = directory.path().join("kesvio-100600-1.log");
        let newest = directory.path().join("kesvio-101200-1.log");
        for path in [&oldest, &middle, &newest] {
            std::fs::write(path, &payload).unwrap();
        }
        std::fs::write(directory.path().join("kesvio-101800-1.log"), &payload).unwrap();

        let pruned = prune_expired_logs(directory.path(), seconds(101_900), MAX_LOG_AGE);

        assert_eq!(pruned.removed, 1);
        assert!(!oldest.exists());
        assert!(middle.exists());
        assert!(newest.exists());
    }

    #[test]
    fn a_file_that_cannot_be_removed_is_reported_rather_than_counted_as_removed() {
        let directory = tempfile::tempdir().unwrap();
        let locked = directory.path().join("kesvio-1000-1.log");
        std::fs::write(&locked, "@1 line\n").unwrap();
        let handle = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&locked)
            .unwrap();

        let pruned = prune_expired_logs(directory.path(), seconds(100_000), MAX_LOG_AGE);

        assert_eq!(
            pruned,
            Pruned {
                removed: 0,
                failed: 1
            }
        );
        assert!(locked.exists());
        drop(handle);
    }

    #[test]
    fn a_missing_directory_is_not_an_error() {
        let directory = tempfile::tempdir().unwrap();

        assert_eq!(
            prune_expired_logs(
                &directory.path().join("absent"),
                SystemTime::now(),
                MAX_LOG_AGE
            ),
            Pruned::default()
        );
    }
}
