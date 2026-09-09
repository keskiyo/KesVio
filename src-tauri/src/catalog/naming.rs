pub(super) fn portable_display_name(
    stem: &str,
    parent: Option<&str>,
    product_name: Option<&str>,
) -> String {
    let folder = if is_generic_executable_stem(stem) {
        parent
            .map(clean_folder_name)
            .filter(|value| !value.is_empty() && !is_generic_executable_stem(value))
    } else {
        None
    };
    folder
        .or_else(|| {
            product_name
                .map(str::to_string)
                .filter(|value| !is_generic_product_name(value))
        })
        .unwrap_or_else(|| clean_portable_name(stem))
}

fn clean_folder_name(value: &str) -> String {
    value
        .replace(['_', '-'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_generic_executable_stem(stem: &str) -> bool {
    let normalized = stem.trim().to_lowercase();
    if normalized.is_empty() {
        return true;
    }
    if normalized
        .chars()
        .all(|character| character.is_ascii_digit())
    {
        return true;
    }
    matches!(
        normalized.as_str(),
        "x86"
            | "x64"
            | "x86_64"
            | "amd64"
            | "ia64"
            | "arm64"
            | "win32"
            | "win64"
            | "app"
            | "application"
            | "launcher"
            | "main"
            | "run"
            | "start"
            | "program"
    )
}

fn is_generic_product_name(value: &str) -> bool {
    [
        "godot engine",
        "electron",
        "chromium",
        "application",
        "java",
        "python",
        "runtime",
        "launcher",
        "windows application",
    ]
    .iter()
    .any(|generic| value.trim().eq_ignore_ascii_case(generic))
}

pub(super) fn normalized_portable_name(value: &str) -> String {
    clean_portable_name(value)
        .chars()
        .filter(|character| character.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn version_boundary(value: &str) -> Option<(usize, usize)> {
    let mut previous: Option<(usize, char)> = None;
    for (index, character) in value.char_indices() {
        if let Some((separator_index, separator)) = previous {
            if character.is_ascii_digit() && matches!(separator, '-' | '_' | ' ') {
                return Some((separator_index, index));
            }
        }
        previous = Some((index, character));
    }
    None
}

// `version_boundary` returns `char_indices` positions, so separator width does not matter.
#[expect(clippy::string_slice)]
fn clean_portable_name(value: &str) -> String {
    let trimmed = value.trim();
    version_boundary(trimmed)
        .map_or(trimmed, |(separator, _)| &trimmed[..separator])
        .replace(['_', '-'], " ")
        .trim()
        .to_string()
}

// `version_boundary` returns `char_indices` positions, so separator width does not matter.
#[expect(clippy::string_slice)]
pub(super) fn portable_version_from_stem(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let (_, digits) = version_boundary(trimmed)?;
    let version = trimmed[digits..].trim();
    (!version.is_empty()).then(|| version.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_version_suffix_is_cut_on_character_boundaries_in_every_script() {
        for stem in [
            "Проводник-2.1",
            "設定アプリ-2.1",
            "설정도구_3.0",
            "إعدادات 4.2",
            "सेटिंग्स-5",
            "การตั้งค่า_6.1",
            "🚀🚀-7.0",
            "İnstaller-8",
        ] {
            assert!(
                !clean_portable_name(stem).is_empty(),
                "empty name for {stem}"
            );
            assert!(
                portable_version_from_stem(stem).is_some(),
                "no version for {stem}"
            );
        }
        assert_eq!(clean_portable_name("設定アプリ-2.1"), "設定アプリ");
        assert_eq!(
            portable_version_from_stem("設定アプリ-2.1").as_deref(),
            Some("2.1")
        );
        assert_eq!(clean_portable_name("🚀🚀-7.0"), "🚀🚀");
    }
}
