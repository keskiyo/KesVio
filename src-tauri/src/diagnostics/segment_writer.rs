use super::retention::SEGMENT_SECONDS;
use std::fs::{File, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;

pub(super) const MAX_SEGMENT_FILE_BYTES: u64 = 4 * 1024 * 1024;
pub(super) const MAX_LINE_BYTES: usize = 8 * 1024;
const TRUNCATION_MARK: char = '…';

pub(super) struct SegmentWriter {
    directory: PathBuf,
    process_id: u32,
    open: Option<OpenSegment>,
}

struct OpenSegment {
    start: u64,
    sequence: u32,
    file: File,
    bytes: u64,
}

impl SegmentWriter {
    pub(super) fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            process_id: std::process::id(),
            open: None,
        }
    }

    pub(super) fn append(&mut self, now_seconds: u64, formatted: &str) -> io::Result<()> {
        let start = segment_start_for(now_seconds);
        let line = bounded_line(now_seconds, formatted);
        if self.open.as_ref().is_none_or(|open| open.start != start) {
            self.open_segment(start, 0)?;
        }
        if self
            .open
            .as_ref()
            .is_some_and(|open| open.bytes + line.len() as u64 > MAX_SEGMENT_FILE_BYTES)
        {
            let sequence = self.open.as_ref().map_or(0, |open| open.sequence);
            let next = sequence
                .checked_add(1)
                .ok_or_else(|| io::Error::other("log segment sequence exhausted"))?;
            self.open_segment(start, next)?;
        }
        let Some(open) = self.open.as_mut() else {
            return Err(io::Error::other("log segment is not open"));
        };
        open.file.write_all(line.as_bytes())?;
        open.bytes += line.len() as u64;
        Ok(())
    }

    fn open_segment(&mut self, start: u64, sequence: u32) -> io::Result<()> {
        self.open = None;
        std::fs::create_dir_all(&self.directory)?;
        let path = self
            .directory
            .join(segment_file_name(start, self.process_id, sequence));
        let file = OpenOptions::new().create(true).append(true).open(path)?;
        let bytes = file.metadata().map_or(0, |metadata| metadata.len());
        self.open = Some(OpenSegment {
            start,
            sequence,
            file,
            bytes,
        });
        Ok(())
    }
}

pub(super) fn segment_start_for(now_seconds: u64) -> u64 {
    now_seconds / SEGMENT_SECONDS * SEGMENT_SECONDS
}

pub(super) fn segment_file_name(start: u64, process_id: u32, sequence: u32) -> String {
    if sequence == 0 {
        format!("kesvio-{start}-{process_id}.log")
    } else {
        format!("kesvio-{start}-{process_id}-{sequence}.log")
    }
}

fn bounded_line(now_seconds: u64, formatted: &str) -> String {
    let mut line = format!("@{now_seconds} ");
    let limit = MAX_LINE_BYTES - TRUNCATION_MARK.len_utf8() - 1;
    for character in formatted.chars() {
        if line.len() + character.len_utf8() > limit {
            line.push(TRUNCATION_MARK);
            break;
        }
        line.push(match character {
            '\n' | '\r' => ' ',
            other => other,
        });
    }
    line.push('\n');
    line
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(directory: &std::path::Path) -> Vec<String> {
        let mut names = std::fs::read_dir(directory)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        names.sort();
        names
    }

    #[test]
    fn writes_in_different_ten_minute_buckets_land_in_different_segments() {
        let directory = tempfile::tempdir().unwrap();
        let mut writer = SegmentWriter::new(directory.path().to_path_buf());

        writer
            .append(120_020, "[d][t][INFO][app_lib] first")
            .unwrap();
        writer
            .append(120_500, "[d][t][INFO][app_lib] same bucket")
            .unwrap();
        writer
            .append(120_600, "[d][t][INFO][app_lib] next bucket")
            .unwrap();

        let pid = std::process::id();
        assert_eq!(
            names(directory.path()),
            vec![
                format!("kesvio-120000-{pid}.log"),
                format!("kesvio-120600-{pid}.log")
            ]
        );
        let first =
            std::fs::read_to_string(directory.path().join(format!("kesvio-120000-{pid}.log")))
                .unwrap();
        assert_eq!(
            first,
            "@120020 [d][t][INFO][app_lib] first\n@120500 [d][t][INFO][app_lib] same bucket\n"
        );
    }

    #[test]
    fn a_full_segment_rolls_to_a_numbered_file_in_the_same_bucket() {
        let directory = tempfile::tempdir().unwrap();
        let mut writer = SegmentWriter::new(directory.path().to_path_buf());
        let payload = "x".repeat(MAX_LINE_BYTES - 64);
        let lines = MAX_SEGMENT_FILE_BYTES as usize / MAX_LINE_BYTES + 8;

        for _ in 0..lines {
            writer.append(120_000, &payload).unwrap();
        }

        let pid = std::process::id();
        assert_eq!(
            names(directory.path()),
            vec![
                format!("kesvio-120000-{pid}-1.log"),
                format!("kesvio-120000-{pid}.log")
            ]
        );
        for name in names(directory.path()) {
            let size = std::fs::metadata(directory.path().join(name))
                .unwrap()
                .len();
            assert!(size <= MAX_SEGMENT_FILE_BYTES);
        }
    }

    #[test]
    fn a_line_is_bounded_and_keeps_to_one_line() {
        let directory = tempfile::tempdir().unwrap();
        let mut writer = SegmentWriter::new(directory.path().to_path_buf());
        let long = format!("head\r\nmiddle\n{}", "y".repeat(MAX_LINE_BYTES * 2));

        writer.append(7, &long).unwrap();

        let contents = std::fs::read_to_string(directory.path().join(segment_file_name(
            0,
            std::process::id(),
            0,
        )))
        .unwrap();
        assert_eq!(contents.lines().count(), 1);
        assert!(contents.starts_with("@7 head  middle "));
        assert!(contents.trim_end().ends_with(TRUNCATION_MARK));
        assert!(contents.len() <= MAX_LINE_BYTES);
    }

    #[test]
    fn the_segment_start_is_the_bucket_floor_and_the_name_carries_the_process() {
        assert_eq!(segment_start_for(120_599), 120_000);
        assert_eq!(segment_start_for(120_600), 120_600);
        assert_eq!(segment_file_name(120_600, 42, 0), "kesvio-120600-42.log");
        assert_eq!(segment_file_name(120_600, 42, 2), "kesvio-120600-42-2.log");
    }
}
