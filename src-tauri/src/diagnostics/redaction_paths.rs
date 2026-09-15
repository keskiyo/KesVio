pub(super) fn path_kind(value: &str) -> Option<&'static str> {
    if ["file://", "https://", "http://"].iter().any(|prefix| {
        value
            .get(..prefix.len())
            .is_some_and(|head| head.eq_ignore_ascii_case(prefix))
    }) {
        return Some("url");
    }
    let bytes = value.as_bytes();
    if value.starts_with(r"\\")
        || (bytes.first().is_some_and(u8::is_ascii_alphabetic)
            && bytes.get(1) == Some(&b':')
            && matches!(bytes.get(2), Some(b'\\' | b'/')))
    {
        return Some("path");
    }
    None
}

const CONTINUATION_STOP_WORDS: [&str; 40] = [
    "after",
    "and",
    "answered",
    "at",
    "because",
    "but",
    "code",
    "denied",
    "duration",
    "elapsed",
    "error",
    "failed",
    "finished",
    "for",
    "found",
    "from",
    "generation",
    "in",
    "is",
    "kind",
    "of",
    "on",
    "or",
    "rebuilt",
    "records",
    "returned",
    "reused",
    "skipped",
    "source",
    "started",
    "starting",
    "status",
    "stopped",
    "thread",
    "to",
    "took",
    "walked",
    "was",
    "with",
    "without",
];

fn ends_with_extension(segment: &str) -> bool {
    let name = segment.rsplit(['\\', '/']).next().unwrap_or_default();
    match name.rsplit_once('.') {
        Some((stem, extension)) => {
            !stem.is_empty()
                && (1..=5).contains(&extension.len())
                && extension.chars().all(|c| c.is_ascii_alphanumeric())
        }
        None => false,
    }
}

fn continues_path(before: &str, token: &str, url: bool) -> bool {
    if url || token.contains('=') || token.ends_with(':') || ends_with_extension(before) {
        return false;
    }
    let word = token
        .trim_end_matches(|c: char| !c.is_alphanumeric())
        .to_lowercase();
    !CONTINUATION_STOP_WORDS.contains(&word.as_str())
}

pub(super) fn value_end(value: &str, quote: Option<char>, url: bool) -> usize {
    for (index, character) in value.char_indices() {
        if matches!(character, '\n' | '\r') {
            return index;
        }
        if let Some(closing) = quote {
            if character == closing {
                return index;
            }
            continue;
        }
        if matches!(
            character,
            '"' | '\'' | '<' | '>' | '|' | ';' | ',' | ')' | ']'
        ) {
            return index;
        }
        if character.is_whitespace() {
            let before = value.get(..index).unwrap_or_default();
            let rest = value.get(index..).unwrap_or_default().trim_start();
            let token = rest.split_whitespace().next().unwrap_or_default();
            if !continues_path(before, token, url) {
                return index;
            }
        }
    }
    value.len()
}

pub(super) fn boundary(character: Option<char>) -> bool {
    character.is_none_or(|value| !value.is_alphanumeric() && value != '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_quoted_value_ends_only_at_its_own_quote_or_a_line_break() {
        assert_eq!(
            value_end("C:\\Users\\O'Brien\\a;b.txt\" rest", Some('"'), false),
            "C:\\Users\\O'Brien\\a;b.txt".len()
        );
        assert_eq!(
            value_end("C:\\Users\\Ann\\a.txt\nnext", Some('"'), false),
            "C:\\Users\\Ann\\a.txt".len()
        );
    }

    // A folder name may hold a space, so a bare path keeps going over one until the next word
    // is a log key, a connective the logger writes after a location, or the path already ended
    // in a file name; a folder that ends in a dotted token is the known cost of that rule.
    #[test]
    fn an_unquoted_value_stops_before_punctuation_the_next_key_or_a_log_word() {
        assert_eq!(
            value_end("C:\\Program Files\\App\\app.exe generation=42", None, false),
            "C:\\Program Files\\App\\app.exe".len()
        );
        assert_eq!(
            value_end("C:\\Users\\Ann\\notes.txt; error=DENIED", None, false),
            "C:\\Users\\Ann\\notes.txt".len()
        );
        assert_eq!(
            value_end("D:\\разный хлам\\Git finished in 3ms", None, false),
            "D:\\разный хлам\\Git".len()
        );
        assert_eq!(
            value_end("C:\\Apps\\tool.exe thread=ThreadId(3)", None, false),
            "C:\\Apps\\tool.exe".len()
        );
        assert_eq!(
            value_end("https://example.com/a b=1", None, true),
            "https://example.com/a".len()
        );
    }

    #[test]
    fn only_absolute_windows_unc_and_web_locations_count_as_paths() {
        assert_eq!(path_kind(r"C:\Users\Ann"), Some("path"));
        assert_eq!(path_kind(r"\\server\share"), Some("path"));
        assert_eq!(path_kind("HTTPS://example.com"), Some("url"));
        assert_eq!(path_kind("relative\\file"), None);
        assert_eq!(path_kind("c:notdrive"), None);
    }
}
