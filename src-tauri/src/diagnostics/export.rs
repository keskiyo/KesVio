use std::path::{Path, PathBuf};
use std::time::SystemTime;

const MAX_EXPORTED_LINES: usize = 20_000;

struct Entry<'a> {
    date: &'a str,
    time: &'a str,
    target: &'a str,
    level: &'a str,
    message: &'a str,
}

pub(crate) fn unix_seconds(now: SystemTime) -> u64 {
    now.duration_since(SystemTime::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

pub(crate) fn log_directory_as_xml(directory: &Path, generated_unix: u64) -> String {
    let lines = collect_lines(directory);
    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str(&format!(
        "<diagnostics application=\"KesVio\" version=\"{}\" generatedUnix=\"{generated_unix}\" entries=\"{}\">\n",
        env!("CARGO_PKG_VERSION"),
        lines.len()
    ));
    for line in &lines {
        xml.push_str(&render(line));
    }
    xml.push_str("</diagnostics>\n");
    xml
}

fn collect_lines(directory: &Path) -> Vec<String> {
    let mut lines = Vec::new();
    for path in log_files(directory) {
        let Ok(contents) = std::fs::read_to_string(&path) else {
            continue;
        };
        lines.extend(
            contents
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(str::to_owned),
        );
    }
    if lines.len() > MAX_EXPORTED_LINES {
        lines.drain(..lines.len() - MAX_EXPORTED_LINES);
    }
    lines
}

fn log_files(directory: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return Vec::new();
    };
    let mut files = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let is_log = path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("log"));
            let modified = entry
                .metadata()
                .and_then(|metadata| metadata.modified())
                .ok();
            (is_log && path.is_file()).then_some((modified, path))
        })
        .collect::<Vec<_>>();
    files.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    files.into_iter().map(|(_, path)| path).collect()
}

fn render(line: &str) -> String {
    match parse(line) {
        Some(entry) => format!(
            "\t<entry date=\"{}\" time=\"{}\" level=\"{}\" target=\"{}\">{}</entry>\n",
            escape(entry.date),
            escape(entry.time),
            escape(entry.level),
            escape(entry.target),
            escape(entry.message)
        ),
        None => format!("\t<line>{}</line>\n", escape(line)),
    }
}

fn parse(line: &str) -> Option<Entry<'_>> {
    let mut rest = line;
    let mut fields = [""; 4];
    for field in &mut fields {
        let closing = rest.strip_prefix('[')?.find(']')? + 1;
        *field = &rest[1..closing];
        rest = &rest[closing + 1..];
    }
    let (level, target) = if is_level(fields[2]) {
        (fields[2], fields[3])
    } else {
        (fields[3], fields[2])
    };
    Some(Entry {
        date: fields[0],
        time: fields[1],
        target,
        level,
        message: rest.trim_start(),
    })
}

fn is_level(value: &str) -> bool {
    matches!(value, "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE")
}

fn escape(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&apos;"),
            control if control.is_control() => escaped.push(' '),
            other => escaped.push(other),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::{escape, log_directory_as_xml, parse, unix_seconds, MAX_EXPORTED_LINES};
    use std::time::{Duration, SystemTime};

    #[test]
    fn a_plugin_formatted_line_becomes_a_structured_entry() {
        let entry = parse("[2026-09-03][22:15:01][INFO][app_lib::catalog] Scan started").unwrap();

        assert_eq!(entry.date, "2026-09-03");
        assert_eq!(entry.time, "22:15:01");
        assert_eq!(entry.target, "app_lib::catalog");
        assert_eq!(entry.level, "INFO");
        assert_eq!(entry.message, "Scan started");
    }

    // Setting a timezone strategy replaces the plugin's own formatter, and the replacement writes
    // the level before the target while the default writes it after. Archived files keep whichever
    // order the build that wrote them used, so both have to read back the same way.
    #[test]
    fn either_field_order_the_plugin_has_written_reads_back_the_same() {
        let level_last =
            parse("[2026-09-02][14:36:18][tauri_plugin_updater::updater][ERROR] endpoint failed")
                .unwrap();

        assert_eq!(level_last.level, "ERROR");
        assert_eq!(level_last.target, "tauri_plugin_updater::updater");
        assert_eq!(level_last.message, "endpoint failed");

        let level_first =
            parse("[2026-09-03][18:21:29][WARN][app_lib::catalog::sync::portable] root stopped")
                .unwrap();

        assert_eq!(level_first.level, "WARN");
        assert_eq!(level_first.target, "app_lib::catalog::sync::portable");
    }

    #[test]
    fn a_line_the_logger_did_not_write_is_kept_verbatim() {
        assert!(parse("thread panicked at src/main.rs").is_none());
        assert!(parse("[2026-09-03][22:15:01] truncated").is_none());
    }

    #[test]
    fn markup_and_control_characters_cannot_escape_their_element() {
        assert_eq!(escape("a<b>&\"c\u{0}'"), "a&lt;b&gt;&amp;&quot;c &apos;");
    }

    #[test]
    fn the_document_wraps_every_line_of_every_log_file() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(
            directory.path().join("kesvio_2026-09-02.log"),
            "[2026-09-02][10:00:00][WARN][app_lib] Root <skipped>\n\n",
        )
        .unwrap();
        std::fs::write(
            directory.path().join("kesvio.log"),
            "raw crash line\n[2026-09-03][22:15:01][INFO][app_lib] Scan started\n",
        )
        .unwrap();

        let xml = log_directory_as_xml(directory.path(), 1_757_000_000);

        assert!(xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"));
        assert!(xml.contains("generatedUnix=\"1757000000\""));
        assert!(xml.contains("entries=\"3\""));
        assert!(xml.contains("level=\"WARN\""));
        assert!(xml.contains("Root &lt;skipped&gt;"));
        assert!(xml.contains("<line>raw crash line</line>"));
        assert!(xml.trim_end().ends_with("</diagnostics>"));
    }

    #[test]
    fn an_unreadable_directory_still_produces_a_valid_document() {
        let directory = tempfile::tempdir().unwrap();

        let xml = log_directory_as_xml(&directory.path().join("absent"), 0);

        assert!(xml.contains("entries=\"0\""));
        assert!(xml.trim_end().ends_with("</diagnostics>"));
    }

    #[test]
    fn only_the_newest_lines_survive_the_export_bound() {
        let directory = tempfile::tempdir().unwrap();
        let mut contents = String::new();
        for index in 0..MAX_EXPORTED_LINES + 10 {
            contents.push_str(&format!("[d][t][INFO][app_lib] line {index}\n"));
        }
        std::fs::write(directory.path().join("kesvio.log"), contents).unwrap();

        let xml = log_directory_as_xml(directory.path(), 0);

        assert!(xml.contains(&format!("entries=\"{MAX_EXPORTED_LINES}\"")));
        assert!(!xml.contains("line 9<"));
        assert!(xml.contains(&format!("line {}<", MAX_EXPORTED_LINES + 9)));
    }

    #[test]
    fn a_clock_before_the_epoch_reports_zero_rather_than_panicking() {
        assert_eq!(
            unix_seconds(SystemTime::UNIX_EPOCH - Duration::from_secs(10)),
            0
        );
        assert!(unix_seconds(SystemTime::now()) > 1_700_000_000);
    }
}
