use super::redaction_paths::{boundary, path_kind, value_end};
use std::collections::HashMap;

const MAX_NAME_BYTES: usize = 256;
const KEY_SCAN_CHARS: usize = 40;
const SENSITIVE_KEYS: [&str; 10] = [
    "password",
    "passwd",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "username",
    "computername",
    "user",
    "machine",
];
const CREDENTIAL_SCHEMES: [&str; 4] = ["bearer", "basic", "digest", "token"];

pub(super) struct Redactor {
    names: Vec<String>,
    tokens: HashMap<String, String>,
}

impl Redactor {
    pub(super) fn from_environment() -> Self {
        Self::new(
            ["USERNAME", "COMPUTERNAME", "USERDOMAIN"]
                .into_iter()
                .filter_map(|key| std::env::var(key).ok())
                .collect(),
        )
    }

    fn new(names: Vec<String>) -> Self {
        Self {
            names: names
                .into_iter()
                .filter(|name| !name.trim().is_empty() && name.len() <= MAX_NAME_BYTES)
                .collect(),
            tokens: HashMap::new(),
        }
    }

    fn token(&mut self, kind: &str, value: &str) -> String {
        let key = format!("{kind}:{}", value.to_lowercase());
        let next = self.tokens.len() + 1;
        self.tokens
            .entry(key)
            .or_insert_with(|| format!("[{kind}-{next}]"))
            .clone()
    }

    pub(super) fn redact(&mut self, value: &str) -> String {
        let mut output = String::with_capacity(value.len());
        let mut rest = value;
        let mut previous = None;
        while !rest.is_empty() {
            if let Some(kind) = path_kind(rest) {
                let quote = previous.filter(|character| matches!(character, '"' | '\''));
                let end = value_end(rest, quote, kind == "url");
                if let Some(raw) = rest.get(..end) {
                    output.push_str(&self.token(kind, raw));
                    rest = rest.get(end..).unwrap_or_default();
                    previous = Some(']');
                    continue;
                }
            }
            if boundary(previous) {
                if let Some(end) = sensitive_value(rest) {
                    let raw = rest.get(..end).unwrap_or_default();
                    output.push_str(&self.token("private", raw));
                    rest = rest.get(end..).unwrap_or_default();
                    previous = Some(']');
                    continue;
                }
                if let Some(end) = self.known_name(rest) {
                    output.push_str(&self.token("identity", rest.get(..end).unwrap_or_default()));
                    rest = rest.get(end..).unwrap_or_default();
                    previous = Some(']');
                    continue;
                }
            }
            let character = rest.chars().next().unwrap_or_default();
            output.push(character);
            rest = rest.get(character.len_utf8()..).unwrap_or_default();
            previous = Some(character);
        }
        output
    }

    fn known_name(&self, rest: &str) -> Option<usize> {
        self.names.iter().find_map(|name| {
            let end: usize = rest
                .chars()
                .take(name.chars().count())
                .map(char::len_utf8)
                .sum();
            let raw = rest.get(..end)?;
            (raw.to_lowercase() == name.to_lowercase() && boundary(rest.get(end..)?.chars().next()))
                .then_some(end)
        })
    }
}

fn sensitive_value(value: &str) -> Option<usize> {
    let prefix_end = value
        .char_indices()
        .nth(KEY_SCAN_CHARS)
        .map_or(value.len(), |(index, _)| index);
    let key_end = value.get(..prefix_end)?.find(['=', ':'])?;
    let key = value
        .get(..key_end)?
        .trim_matches([' ', '\t', '"', '\''])
        .to_ascii_lowercase();
    if !SENSITIVE_KEYS.contains(&key.as_str()) {
        return None;
    }
    let after = value.get(key_end + 1..)?;
    let trimmed = after.trim_start();
    let padding = after.len() - trimmed.len();
    let quote = trimmed.chars().next().filter(|c| matches!(c, '"' | '\''));
    let body = match quote {
        Some(_) => trimmed.get(1..)?,
        None => trimmed,
    };
    let length = match quote {
        Some(closing) => body.find(closing).unwrap_or(body.len()),
        None => unquoted_credential_end(body),
    };
    if length == 0 {
        return None;
    }
    let closing = usize::from(quote.is_some() && body.len() > length);
    Some(key_end + 1 + padding + usize::from(quote.is_some()) + length + closing)
}

fn unquoted_token_end(body: &str) -> usize {
    body.find(|c: char| c.is_whitespace() || matches!(c, ',' | ';'))
        .unwrap_or(body.len())
}

fn unquoted_credential_end(body: &str) -> usize {
    let first = unquoted_token_end(body);
    let scheme = body.get(..first).unwrap_or_default().to_ascii_lowercase();
    if !CREDENTIAL_SCHEMES.contains(&scheme.as_str()) {
        return first;
    }
    let after = body.get(first..).unwrap_or_default();
    let gap = after.len() - after.trim_start().len();
    let credential = unquoted_token_end(after.trim_start());
    if gap == 0 || credential == 0 {
        return first;
    }
    first + gap + credential
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_multiline_secrets_and_bearer_credentials_do_not_leave_fragments() {
        let mut redactor = Redactor::new(vec![]);
        let output = redactor.redact("path=\"C:\\Users\\O'Brien\\private;notes.txt\" source=portable\npassword=\"first\nsecond\" error=DENIED\nauthorization=Bearer secret-token status=401");
        for secret in ["Brien", "notes", "first", "second", "secret-token"] {
            assert!(!output.contains(secret), "leaked {secret}: {output}");
        }
        assert!(output.contains("source=portable"));
        assert!(output.contains("status=401"));
    }

    #[test]
    fn windows_unc_unicode_and_uri_values_are_hidden_with_stable_tokens() {
        let mut redactor = Redactor::new(vec!["Maks".into(), "WORK-PC".into()]);
        let input = "root=\"C:\\Users\\Maks\\Мои файлы\\app.exe\" source=portable generation=42\nUNC=\\\\server\\share\\private file.exe duration=5\nurl=https://user:secret@example.com/path?token=secret\nMaks WORK-PC";
        let output = redactor.redact(input);
        for secret in ["Maks", "WORK-PC", "server", "share", "secret", "Мои файлы"] {
            assert!(!output.contains(secret));
        }
        assert!(output.contains("source=portable generation=42"));
        assert!(output.contains("duration=5"));
        assert_eq!(
            redactor.redact(r"C:\Users\Maks\Мои файлы\app.exe"),
            "[path-1]"
        );
    }

    #[test]
    fn credentials_and_known_names_are_removed_without_erasing_substrings() {
        let mut redactor = Redactor::new(vec!["ann".into()]);
        let output = redactor.redact(
            "ann scanning password=\"secret value\" user=someone error=DENIED token=abc\nnext",
        );
        for secret in ["secret", "someone", "abc"] {
            assert!(!output.contains(secret));
        }
        assert!(output.contains("scanning"));
        assert!(output.contains("error=DENIED"));
        assert!(output.ends_with("\nnext"));
    }

    // The same folder is named on many lines of one export; one token per distinct value keeps
    // those lines correlated, and the case Windows happened to use does not split the token.
    #[test]
    fn a_repeated_location_keeps_one_token_across_lines_and_letter_case() {
        let mut redactor = Redactor::new(vec![]);
        let output = redactor.redact(
            "Portable root C:\\Apps\\Tools finished\nPortable root c:\\apps\\tools reused\nIndex C:\\Apps\\Other rebuilt",
        );

        assert_eq!(
            output,
            "Portable root [path-1] finished\nPortable root [path-1] reused\nIndex [path-2] rebuilt"
        );
    }

    #[test]
    fn a_short_name_from_the_environment_is_matched_as_a_whole_word_only() {
        let mut redactor = Redactor::new(vec!["Ann".into(), "   ".into()]);

        assert_eq!(
            redactor.redact("Ann ran Annotate for ann_smith"),
            "[identity-1] ran Annotate for ann_smith"
        );
    }
}
