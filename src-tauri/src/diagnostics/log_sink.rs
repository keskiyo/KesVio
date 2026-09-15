use super::retention::unix_seconds;
use super::segment_writer::SegmentWriter;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tauri_plugin_log::fern;

const MAX_PENDING_LINES: usize = 256;

#[derive(Clone)]
pub(crate) struct LogSink(Arc<Mutex<SinkState>>);

enum SinkState {
    Pending(Vec<(u64, String)>),
    Writing(SegmentWriter),
}

impl LogSink {
    pub(crate) fn new(directory: Option<PathBuf>) -> Self {
        let state = match directory {
            Some(directory) => SinkState::Writing(SegmentWriter::new(directory)),
            None => SinkState::Pending(Vec::new()),
        };
        Self(Arc::new(Mutex::new(state)))
    }

    pub(crate) fn attach(&self, directory: &Path) {
        let Ok(mut state) = self.0.lock() else {
            return;
        };
        if let SinkState::Pending(pending) = &mut *state {
            let mut writer = SegmentWriter::new(directory.to_path_buf());
            for (seconds, line) in pending.drain(..) {
                let _ = writer.append(seconds, &line);
            }
            *state = SinkState::Writing(writer);
        }
    }

    pub(crate) fn output(&self) -> fern::Output {
        let sink = self.clone();
        fern::Output::call(move |record| sink.write(&record.args().to_string()))
    }

    fn write(&self, line: &str) {
        let seconds = unix_seconds(SystemTime::now());
        let Ok(mut state) = self.0.lock() else {
            return;
        };
        match &mut *state {
            SinkState::Pending(pending) => {
                if pending.len() >= MAX_PENDING_LINES {
                    pending.remove(0);
                }
                pending.push((seconds, line.to_owned()));
            }
            SinkState::Writing(writer) => {
                let _ = writer.append(seconds, line);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn written(directory: &Path) -> String {
        let mut contents = String::new();
        let mut paths = std::fs::read_dir(directory)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .collect::<Vec<_>>();
        paths.sort();
        for path in paths {
            contents.push_str(&std::fs::read_to_string(path).unwrap());
        }
        contents
    }

    #[test]
    fn lines_written_before_the_directory_is_known_are_flushed_first_and_in_order() {
        let directory = tempfile::tempdir().unwrap();
        let sink = LogSink::new(None);

        sink.write("early one");
        sink.write("early two");
        sink.attach(directory.path());
        sink.write("late");

        let contents = written(directory.path());
        let messages = contents
            .lines()
            .map(|line| line.split_once(' ').map(|(_, rest)| rest).unwrap_or(line))
            .collect::<Vec<_>>();
        assert_eq!(messages, vec!["early one", "early two", "late"]);
        assert!(contents.lines().all(|line| line.starts_with('@')));
    }

    #[test]
    fn the_pending_buffer_keeps_only_the_newest_lines() {
        let directory = tempfile::tempdir().unwrap();
        let sink = LogSink::new(None);

        for index in 0..MAX_PENDING_LINES + 5 {
            sink.write(&format!("line {index}"));
        }
        sink.attach(directory.path());

        let contents = written(directory.path());
        assert_eq!(contents.lines().count(), MAX_PENDING_LINES);
        assert!(!contents.contains("line 4\n"));
        assert!(contents.contains("line 5\n"));
        assert!(contents.contains(&format!("line {}\n", MAX_PENDING_LINES + 4)));
    }

    #[test]
    fn a_sink_created_with_a_directory_writes_at_once_and_ignores_a_second_attach() {
        let directory = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let sink = LogSink::new(Some(directory.path().to_path_buf()));

        sink.write("direct");
        sink.attach(other.path());
        sink.write("still direct");

        assert_eq!(written(directory.path()).lines().count(), 2);
        assert!(std::fs::read_dir(other.path()).unwrap().next().is_none());
    }
}
