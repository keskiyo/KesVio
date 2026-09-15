use super::retention::{segment_start, unix_seconds, MAX_LOG_AGE};
use super::segment_writer::MAX_LINE_BYTES;
use std::collections::VecDeque;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

pub(super) const MAX_EXPORTED_LINES: usize = 20_000;
const MAX_INPUT_BYTES: u64 = 16 * 1024 * 1024;
const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_SELECTED_BYTES: usize = 4 * 1024 * 1024;

pub(super) struct Collected {
    pub(super) lines: Vec<String>,
    pub(super) truncated: bool,
}

pub(super) fn collect_lines(directory: &Path, now: u64) -> Collected {
    let (files, mut truncated) = log_files(directory);
    let mut remaining = MAX_INPUT_BYTES;
    let mut selected_bytes = 0;
    let mut selected = VecDeque::new();
    for path in files.into_iter().rev() {
        let Ok(mut file) = std::fs::File::open(path) else {
            continue;
        };
        let Ok(metadata) = file.metadata() else {
            continue;
        };
        let take = metadata.len().min(MAX_FILE_BYTES).min(remaining);
        if take < metadata.len() {
            truncated = true;
        }
        if take == 0 {
            continue;
        }
        let offset = metadata.len() - take;
        if file.seek(SeekFrom::Start(offset)).is_err() {
            continue;
        }
        let mut bytes = Vec::new();
        if file.take(take).read_to_end(&mut bytes).is_err() {
            continue;
        }
        remaining -= take;
        let contents = String::from_utf8_lossy(&bytes);
        let mut lines = contents.lines().collect::<Vec<_>>();
        if offset > 0 && !lines.is_empty() {
            lines.remove(0);
        }
        for line in lines.into_iter().rev() {
            if line.len() > MAX_LINE_BYTES {
                truncated = true;
                continue;
            }
            let Some(line) = within_window(line, now) else {
                continue;
            };
            if line.trim().is_empty() {
                continue;
            }
            if selected.len() >= MAX_EXPORTED_LINES
                || selected_bytes + line.len() > MAX_SELECTED_BYTES
            {
                truncated = true;
                continue;
            }
            selected_bytes += line.len();
            selected.push_front(line.to_owned());
        }
    }
    Collected {
        lines: selected.into(),
        truncated,
    }
}

fn within_window(line: &str, now: u64) -> Option<&str> {
    let stamped = line
        .strip_prefix('@')
        .and_then(|rest| rest.split_once(' '))
        .and_then(|(stamp, rest)| stamp.parse::<u64>().ok().map(|seconds| (seconds, rest)));
    match stamped {
        Some((seconds, rest)) => {
            (seconds <= now && now - seconds <= MAX_LOG_AGE.as_secs()).then_some(rest)
        }
        None => Some(line),
    }
}

fn log_files(directory: &Path) -> (Vec<PathBuf>, bool) {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return (Vec::new(), false);
    };
    let mut files = Vec::new();
    let mut truncated = false;
    for (index, entry) in entries.enumerate() {
        if index >= 512 {
            truncated = true;
            break;
        }
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if !entry.file_type().is_ok_and(|kind| kind.is_file())
            || !path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("log"))
        {
            continue;
        }
        let order = segment_start(&path).or_else(|| {
            entry
                .metadata()
                .and_then(|meta| meta.modified())
                .ok()
                .map(unix_seconds)
        });
        files.push((order, path));
    }
    files.sort();
    (files.into_iter().map(|(_, path)| path).collect(), truncated)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn oversized_lines_are_omitted_and_future_timestamps_do_not_enter_the_window() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(
            directory.path().join("kesvio.log"),
            format!(
                "{}\n@101 future\n@100 current\n",
                "x".repeat(MAX_LINE_BYTES + 1)
            ),
        )
        .unwrap();
        let result = collect_lines(directory.path(), 100);
        assert_eq!(result.lines, ["current"]);
        assert!(result.truncated);
    }
}
