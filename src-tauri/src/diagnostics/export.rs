#[cfg(test)]
use super::retention::unix_seconds;
use super::retention::MAX_LOG_AGE;
use std::path::Path;

use super::log_collection::collect_lines;
#[cfg(test)]
use super::log_collection::MAX_EXPORTED_LINES;
use super::redaction::Redactor;

struct Entry<'a> {
    date: &'a str,
    time: &'a str,
    target: &'a str,
    level: &'a str,
    message: &'a str,
}

pub(crate) fn log_directory_as_xml(directory: &Path, generated_unix: u64) -> String {
    let collected = collect_lines(directory, generated_unix);
    let lines = collected.lines;
    let mut redactor = Redactor::from_environment();
    let sanitized = redactor.redact(&lines.join("\n"));
    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str(&format!(
        "<diagnostics application=\"KesVio\" version=\"{}\" generatedUnix=\"{generated_unix}\" windowSeconds=\"{}\" redacted=\"true\" truncated=\"{}\" entries=\"{}\" panics=\"{}\">\n",
        env!("CARGO_PKG_VERSION"),
        MAX_LOG_AGE.as_secs(),
        collected.truncated,
        sanitized.lines().count(),
        recorded_panics(&lines)
    ));
    for line in sanitized.lines() {
        xml.push_str(&render(line));
    }
    xml.push_str("</diagnostics>\n");
    xml
}

pub(crate) fn preview_xml(xml: &str) -> String {
    const LIMIT: usize = 16 * 1024;
    if xml.len() <= LIMIT {
        return xml.to_owned();
    }
    let end = xml
        .char_indices()
        .take_while(|(index, _)| *index <= LIMIT)
        .last()
        .map_or(0, |(index, _)| index);
    format!(
        "{}\n[Preview truncated. Export contains the remaining entries.]",
        xml.get(..end).unwrap_or_default()
    )
}

fn recorded_panics(lines: &[String]) -> usize {
    lines
        .iter()
        .filter(|line| {
            parse(line).is_some_and(|entry| {
                entry.target.ends_with("panic_log") && entry.message.starts_with("Rust panic:")
            })
        })
        .count()
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

// Brackets are one ASCII byte each, so a `find(']')` index and its successor stay on boundaries.
#[expect(clippy::string_slice)]
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
    fn the_export_header_counts_recorded_panics() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(
            directory.path().join("kesvio.log"),
            concat!(
                "[2026-09-09][07:34:29][ERROR][app_lib::diagnostics::panic_log] Rust panic: thread=ThreadId(8) location=src\\a.rs:1:1\n",
                "[2026-09-09][07:34:29][ERROR][app_lib::diagnostics::panic_log] Panic backtrace:    0: <unknown>\n",
                "[2026-09-09][07:34:29][INFO][app_lib::catalog] Rust panic: is only an application name here\n",
            ),
        )
        .unwrap();

        let xml = log_directory_as_xml(directory.path(), 0);

        assert!(xml.contains("entries=\"3\""));
        assert!(xml.contains("panics=\"1\""));
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

    #[test]
    fn an_event_older_than_the_window_is_dropped_even_from_a_file_written_just_now() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(
            directory.path().join("kesvio-10000-7.log"),
            concat!(
                "@10000 [d][t][INFO][app_lib] expired\n",
                "@10001 [d][t][INFO][app_lib] boundary\n",
                "@17201 [d][t][INFO][app_lib] current\n",
            ),
        )
        .unwrap();

        let xml = log_directory_as_xml(directory.path(), 17_201);

        assert!(!xml.contains("expired"));
        assert!(xml.contains(">boundary<"));
        assert!(xml.contains(">current<"));
        assert!(xml.contains("entries=\"2\""));
        assert!(xml.contains("windowSeconds=\"7200\""));
    }

    #[test]
    fn the_timestamp_prefix_is_stripped_and_a_malformed_one_is_kept_verbatim() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(
            directory.path().join("kesvio-100000-7.log"),
            concat!(
                "@100000 [2026-09-13][14:00:00][INFO][app_lib] stamped\n",
                "@later [2026-09-13][14:00:01][INFO][app_lib] unstamped\n",
                "@100001\n",
            ),
        )
        .unwrap();

        let xml = log_directory_as_xml(directory.path(), 100_100);

        assert!(xml.contains("<entry date=\"2026-09-13\" time=\"14:00:00\" level=\"INFO\" target=\"app_lib\">stamped</entry>"));
        assert!(xml.contains("<line>@later [2026-09-13][14:00:01][INFO][app_lib] unstamped</line>"));
        assert!(xml.contains("<line>@100001</line>"));
        assert!(xml.contains("entries=\"3\""));
    }

    #[test]
    fn the_export_is_redacted_before_it_is_escaped_and_keeps_locations_correlated() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(
            directory.path().join("kesvio.log"),
            concat!(
                "[d][t][INFO][app_lib] Portable root C:\\Users\\Ann\\Apps finished in 3ms\n",
                "[d][t][WARN][app_lib] Portable root C:\\Users\\Ann\\Apps stopped <depth> & more\n",
                "[d][t][INFO][app_lib] Scan step: \\\\nas\\share\\tool.exe thread=ThreadId(3)\n",
            ),
        )
        .unwrap();

        let xml = log_directory_as_xml(directory.path(), 0);

        assert!(!xml.contains("Ann"));
        assert!(!xml.contains("nas"));
        assert!(xml.contains(">Portable root [path-1] finished in 3ms</entry>"));
        assert!(xml.contains(">Portable root [path-1] stopped &lt;depth&gt; &amp; more</entry>"));
        assert!(xml.contains(">Scan step: [path-2] thread=ThreadId(3)</entry>"));
        assert!(xml.contains("redacted=\"true\""));
    }

    #[test]
    fn segments_are_exported_in_time_order_regardless_of_how_they_were_written() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(
            directory.path().join("kesvio-100600-7.log"),
            "@100600 [d][t][INFO][app_lib] second\n",
        )
        .unwrap();
        std::fs::write(
            directory.path().join("kesvio-100000-7.log"),
            "@100000 [d][t][INFO][app_lib] first\n",
        )
        .unwrap();

        let xml = log_directory_as_xml(directory.path(), 100_700);

        assert!(xml.find(">first<").unwrap() < xml.find(">second<").unwrap());
    }
}
