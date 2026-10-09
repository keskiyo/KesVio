use serde::Serialize;
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

const MAX_ENTRIES: u64 = 200_000;
const MAX_DURATION: Duration = Duration::from_secs(10);

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FolderSize {
    pub bytes: u64,
    pub files: u64,
    pub complete: bool,
}

pub(crate) fn measure_folder(root: &Path) -> FolderSize {
    measure_folder_within(root, MAX_ENTRIES, MAX_DURATION)
}

fn measure_folder_within(root: &Path, max_entries: u64, max_duration: Duration) -> FolderSize {
    let started = Instant::now();
    let mut size = FolderSize {
        complete: true,
        ..FolderSize::default()
    };
    let mut entries = 0_u64;
    for entry in WalkDir::new(root).follow_links(false) {
        entries = entries.saturating_add(1);
        if entries > max_entries || started.elapsed() > max_duration {
            size.complete = false;
            break;
        }
        let Ok(entry) = entry else {
            size.complete = false;
            continue;
        };
        if !entry.file_type().is_file() {
            continue;
        }
        match entry.metadata() {
            Ok(metadata) => {
                size.bytes = size.bytes.saturating_add(metadata.len());
                size.files = size.files.saturating_add(1);
            }
            Err(_) => size.complete = false,
        }
    }
    size
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn sample_tree() -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        fs::write(root.path().join("app.exe"), vec![0_u8; 1_000]).unwrap();
        fs::create_dir(root.path().join("data")).unwrap();
        fs::write(root.path().join("data").join("a.bin"), vec![0_u8; 250]).unwrap();
        fs::write(root.path().join("data").join("b.bin"), vec![0_u8; 50]).unwrap();
        root
    }

    #[test]
    fn sums_every_file_below_the_folder() {
        let root = sample_tree();

        assert_eq!(
            measure_folder(root.path()),
            FolderSize {
                bytes: 1_300,
                files: 3,
                complete: true,
            }
        );
    }

    #[test]
    fn reports_a_partial_total_when_the_entry_budget_runs_out() {
        let root = sample_tree();

        let size = measure_folder_within(root.path(), 2, MAX_DURATION);

        assert!(!size.complete);
        assert!(size.files < 3);
    }

    #[test]
    fn a_missing_folder_is_an_incomplete_empty_total() {
        let root = tempfile::tempdir().unwrap();

        let size = measure_folder(&root.path().join("gone"));

        assert_eq!(size.bytes, 0);
        assert!(!size.complete);
    }
}
